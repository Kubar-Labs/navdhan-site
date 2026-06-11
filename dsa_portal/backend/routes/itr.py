"""
ITR — try-then-collect mode.

POST /itr/save  — try Perfios ITR Business API first; on any failure, fall
                  back to storing PAN + encrypted IT portal password so the
                  lender can retry later. No schema change required: the
                  existing `itr_verifications` row stores either outcome.
POST /itr/fetch — strict-fetch endpoint (raises on Perfios failure).
"""

import json
import logging
from typing import Any, Optional
import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.sql import func
from storage.gcs import build_doc_path, upload_bytes


def _coerce_text(v: Any) -> Optional[str]:
    """Perfios returns some fields as dicts (e.g. address) while our column is
    TEXT. JSON-stringify dicts/lists; pass through str/None unchanged."""
    if v is None or isinstance(v, str):
        return v
    if isinstance(v, (dict, list)):
        return json.dumps(v, ensure_ascii=False)
    return str(v)

from models.schemas import ITRFetchRequest, ITRFetchResponse, PersistenceInfo
from services.perfios import get_client, post
from services.verification import get_or_create_case
from security.crypto import encrypt, sha256_hex, last_n
from storage.gcs import download_to_gcs
from db.session import get_session
from db.models import ItrVerification
from config import BASE_ITR

log = logging.getLogger(__name__)

router = APIRouter(prefix="/itr", tags=["ITR"])

# Defaults used when /itr/save triggers the Business API. Mirrors the
# latest Perfios spec (1.0.2 includes AIS data) and tolerates partial sources.
_AUTO_API_VERSION    = "1.0.2"
_AUTO_ADDITIONAL     = True
_AUTO_PARTIAL_REPORT = True


class ITRSaveRequest(BaseModel):
    pan:             str = Field(..., min_length=10, max_length=10)
    password:        str
    case_id:         str
    number_of_years: Optional[int] = Field(3, ge=1, le=3)


@router.post("/save")
async def save_itr_credentials(req: ITRSaveRequest,
                                client: httpx.AsyncClient = Depends(get_client),
                                db: AsyncSession = Depends(get_session)):
    """
    Try the Perfios ITR Business API first; on any failure (HTTP error,
    timeout, non-101 statusCode), fall back to encrypted credential storage.
    """
    pan     = req.pan.upper().strip()
    case    = await get_or_create_case(db, case_id=req.case_id, pan=pan)
    n_years = req.number_of_years or 3

    payload = {
        "consent":        "Y",
        "username":       pan,
        "password":       req.password,
        "apiVersion":     _AUTO_API_VERSION,
        "numberOfYears":  n_years,
        "additionalData": _AUTO_ADDITIONAL,
        "partialReport":  _AUTO_PARTIAL_REPORT,
    }

    fetch_result: Optional[dict] = None
    fetch_error_reason: Optional[str] = None
    fetch_error_code:   Optional[str] = None

    try:
        fetch_result = await post(client, f"{BASE_ITR}/v1/itr-return-forms",
                                   payload, req.case_id)
        code = fetch_result.get("statusCode") or fetch_result.get("status-code")
        if str(code) != "101":
            fetch_error_code   = str(code) if code is not None else None
            fetch_error_reason = (fetch_result.get("message")
                                   or "Perfios returned non-success status")
            fetch_result = None  # treat as failed; fall through to COLLECTED
    except httpx.HTTPStatusError as e:
        fetch_error_code   = str(e.response.status_code)
        fetch_error_reason = f"Perfios HTTP {e.response.status_code}"
        log.warning("ITR fetch failed for case_id=%s: %s", req.case_id, fetch_error_reason)
    except Exception as e:
        fetch_error_code   = "EXCEPTION"
        fetch_error_reason = f"{type(e).__name__}: {e}"
        log.warning("ITR fetch errored for case_id=%s: %s", req.case_id, fetch_error_reason)

    # ── Success path: persist full fetch result ───────────────────────────────
    if fetch_result is not None:
        r  = fetch_result.get("result") or {}
        gi = r.get("generalInformation") or {}
        pdf_url   = fetch_result.get("pdfDownloadLink")
        excel_url = fetch_result.get("excelReportLink")

        pdf_ref = await download_to_gcs(
            pdf_url,
            f"cases/{req.case_id}/itr/itr.pdf",
            content_type="application/pdf",
        ) if pdf_url else None
        excel_ref = await download_to_gcs(
            excel_url,
            f"cases/{req.case_id}/itr/itr.xlsx",
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ) if excel_url else None

        values = {
            "case_id":                        case.id,
            "pan_hash":                       sha256_hex(pan),
            "pan_ciphertext":                 encrypt(pan),
            "pan_last_4":                     last_n(pan, 4),
            "portal_password_ciphertext":     encrypt(req.password),
            "api_version":                    _AUTO_API_VERSION,
            "number_of_years_requested":      n_years,
            "additional_data_requested":      _AUTO_ADDITIONAL,
            "partial_report_requested":       _AUTO_PARTIAL_REPORT,

            "entity_name":                    _coerce_text(gi.get("entityName")),
            "entity_pan":                     _coerce_text(gi.get("entityPan")),
            "entity_type":                    _coerce_text(gi.get("statusOfEntity")),
            "date_of_birth_or_incorporation": _coerce_text(gi.get("dateOfBirthOrIncorporation")),
            "entity_address":                 _coerce_text(gi.get("address")),

            "pdf_download_link":              pdf_url,
            "excel_report_link":              excel_url,
            "pdf_gcs_bucket":                 pdf_ref.bucket   if pdf_ref   else None,
            "pdf_gcs_path":                   pdf_ref.path     if pdf_ref   else None,
            "excel_gcs_bucket":               excel_ref.bucket if excel_ref else None,
            "excel_gcs_path":                 excel_ref.path   if excel_ref else None,

            "status":                         "COMPLETED",
            "input_method":                   "credentials",
            "perfios_status_code":            "101",
            "perfios_request_id":             fetch_result.get("requestId") or fetch_result.get("request_id"),
            "error_code":                     None,
            "error_reason":                   None,
            "raw_response":                   fetch_result,
        }
        update_set = {k: v for k, v in values.items() if k != "case_id"}
        update_set["updated_at"] = func.now()
        stmt = pg_insert(ItrVerification).values(**values).on_conflict_do_update(
            index_elements=["case_id"], set_=update_set,
        ).returning(ItrVerification)
        row = (await db.execute(stmt)).scalar_one()

        if gi.get("entityName") and not case.borrower_name:
            case.borrower_name = gi["entityName"]
            await db.flush()

        return {
            "case_uuid":       str(case.id),
            "verification_id": str(row.id),
            "status":          "FETCHED",
            "pan_last_4":      last_n(pan, 4),
            "entity_name":     gi.get("entityName"),
            "pdf_link":        pdf_url,
            "excel_link":      excel_url,
        }

    # ── Fallback path: encrypted credentials only ─────────────────────────────
    values = {
        "case_id":                    case.id,
        "pan_hash":                   sha256_hex(pan),
        "pan_ciphertext":             encrypt(pan),
        "pan_last_4":                 last_n(pan, 4),
        "portal_password_ciphertext": encrypt(req.password),
        "number_of_years_requested":  n_years,
        "status":                     "COLLECTED",
        "input_method":               "credentials",
        "error_code":                 fetch_error_code,
        "error_reason":               fetch_error_reason,
    }
    update_set = {k: v for k, v in values.items() if k != "case_id"}
    update_set["updated_at"] = func.now()
    stmt = pg_insert(ItrVerification).values(**values).on_conflict_do_update(
        index_elements=["case_id"], set_=update_set,
    ).returning(ItrVerification)
    row = (await db.execute(stmt)).scalar_one()

    return {
        "case_uuid":          str(case.id),
        "verification_id":    str(row.id),
        "status":             "COLLECTED",
        "pan_last_4":         last_n(pan, 4),
        "fetch_error_reason": fetch_error_reason,
    }


@router.post("/fetch", response_model=ITRFetchResponse)
async def fetch_itr(req: ITRFetchRequest,
                    client: httpx.AsyncClient = Depends(get_client),
                    db: AsyncSession = Depends(get_session)):
    case = await get_or_create_case(db, case_id=req.case_id, pan=req.pan)

    payload = {
        "consent":        "Y",
        "username":       req.pan,
        "password":       req.password,    # pass-through, never stored
        "apiVersion":     req.api_version,
        "numberOfYears":  req.number_of_years,
        "additionalData": req.additional_data,
        "partialReport":  req.partial_report,
    }
    result = await post(client, f"{BASE_ITR}/v1/itr-return-forms",
                         payload, req.case_id)

    code     = result.get("statusCode") or result.get("status-code")
    verified = str(code) == "101"

    r  = result.get("result") or {}
    gi = r.get("generalInformation") or {}

    pdf_url   = result.get("pdfDownloadLink")
    excel_url = result.get("excelReportLink")

    # Archive Perfios files to our GCS (so they don't vanish in 14 days)
    pdf_ref   = await download_to_gcs(
        pdf_url,
        f"cases/{req.case_id}/itr/itr.pdf",
        content_type="application/pdf",
    ) if pdf_url else None
    excel_ref = await download_to_gcs(
        excel_url,
        f"cases/{req.case_id}/itr/itr.xlsx",
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ) if excel_url else None

    values = {
        "case_id":                        case.id,
        "pan_hash":                       sha256_hex(req.pan),
        "pan_ciphertext":                 encrypt(req.pan),
        "pan_last_4":                     last_n(req.pan, 4),
        "api_version":                    req.api_version,
        "number_of_years_requested":      req.number_of_years,
        "additional_data_requested":      req.additional_data,
        "partial_report_requested":       req.partial_report,

        "entity_name":                    _coerce_text(gi.get("entityName")),
        "entity_pan":                     _coerce_text(gi.get("entityPan")),
        "entity_type":                    _coerce_text(gi.get("statusOfEntity")),
        "date_of_birth_or_incorporation": _coerce_text(gi.get("dateOfBirthOrIncorporation")),
        "entity_address":                 _coerce_text(gi.get("address")),

        "pdf_download_link":              pdf_url,
        "excel_report_link":              excel_url,
        "pdf_gcs_bucket":                 pdf_ref.bucket   if pdf_ref   else None,
        "pdf_gcs_path":                   pdf_ref.path     if pdf_ref   else None,
        "excel_gcs_bucket":               excel_ref.bucket if excel_ref else None,
        "excel_gcs_path":                 excel_ref.path   if excel_ref else None,

        "status":                         "COMPLETED" if verified else "FAILED",
        "perfios_status_code":            str(code) if code is not None else None,
        "perfios_request_id":             result.get("requestId") or result.get("request_id"),
        "error_code":                     None if verified else str(code),
        "error_reason":                   None if verified else (result.get("message") or "Verification failed"),

        "raw_response":                   result,
    }

    update_set = {k: v for k, v in values.items() if k != "case_id"}
    update_set["updated_at"] = func.now()
    stmt = pg_insert(ItrVerification).values(**values).on_conflict_do_update(
        index_elements=["case_id"], set_=update_set,
    ).returning(ItrVerification)
    row = (await db.execute(stmt)).scalar_one()

    if gi.get("entityName") and not case.borrower_name:
        case.borrower_name = gi["entityName"]
        await db.flush()

    return ITRFetchResponse(
        status_code = code,
        request_id  = result.get("requestId")  or result.get("request_id"),
        entity_name = gi.get("entityName"),
        entity_pan  = gi.get("entityPan"),
        entity_type = gi.get("statusOfEntity"),
        itr_filed   = r.get("itrFilled") or [],
        pdf_link    = pdf_url,
        excel_link  = excel_url,
        raw         = result,
        persistence = PersistenceInfo(case_uuid=str(case.id),
                                       verification_id=str(row.id),
                                       verified=verified),
    )


# ── Alternative input paths: upload a sheet, or explicitly skip ────────────

_UPLOAD_ALLOWED_EXT = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv"}


@router.post("/upload")
async def upload_itr_sheet(
    case_id: str        = Form(...),
    file:    UploadFile = File(...),
    db:      AsyncSession = Depends(get_session),
):
    """User uploads an ITR document (any FY) when they won't share IT-portal
    credentials. File goes to GCS; we record the link on itr_verifications
    with input_method='upload'. The lender reviews the file later."""
    name = (file.filename or "").lower()
    ext  = next((e for e in _UPLOAD_ALLOWED_EXT if name.endswith(e)), None)
    if not ext:
        raise HTTPException(400, "Only PDF, DOC, DOCX, XLS, XLSX, or CSV files are accepted")

    content = await file.read()
    if not content:
        raise HTTPException(400, "Empty file")

    case = await get_or_create_case(db, case_id=case_id)
    gcs_path = build_doc_path(case_id, "itr_sheet", file.filename or f"itr{ext}")
    up = await upload_bytes(gcs_path, content,
                             file.content_type or "application/octet-stream")
    gcs_url = f"gs://{up.bucket}/{up.path}"

    values = {
        "case_id":                  case.id,
        # itr_verifications has NOT NULL on pan_hash/pan_ciphertext; we use a
        # sentinel for the no-PAN upload path. The lender will still get the
        # case_id linkage; PAN can be filled in later from the file's contents.
        "pan_hash":                 sha256_hex(f"upload:{case_id}"),
        "pan_ciphertext":           encrypt(f"upload:{case_id}"),
        "pan_last_4":               None,
        "status":                   "UPLOADED",
        "input_method":             "upload",
        "upload_gcs_bucket":        up.bucket,
        "upload_gcs_path":          up.path,
        "upload_gcs_url":           gcs_url,
        "upload_content_type":      up.content_type,
        "upload_size_bytes":        up.size_bytes,
        "upload_sha256":            up.sha256,
        "upload_original_filename": file.filename,
    }
    update_set = {k: v for k, v in values.items() if k != "case_id"}
    update_set["updated_at"] = func.now()
    stmt = pg_insert(ItrVerification).values(**values).on_conflict_do_update(
        index_elements=["case_id"], set_=update_set,
    ).returning(ItrVerification)
    row = (await db.execute(stmt)).scalar_one()

    return {
        "case_uuid":       str(case.id),
        "verification_id": str(row.id),
        "status":          "UPLOADED",
        "gcs_url":         gcs_url,
        "filename":        file.filename,
        "size_bytes":      up.size_bytes,
    }


class ITRSkipRequest(BaseModel):
    case_id: str


@router.post("/skip")
async def skip_itr(req: ITRSkipRequest,
                    db: AsyncSession = Depends(get_session)):
    """User explicitly skipped both upload and credentials. We persist
    input_method='skipped' so the lender / future GST-based estimator knows."""
    case = await get_or_create_case(db, case_id=req.case_id)
    values = {
        "case_id":        case.id,
        "pan_hash":       sha256_hex(f"skip:{req.case_id}"),
        "pan_ciphertext": encrypt(f"skip:{req.case_id}"),
        "pan_last_4":     None,
        "status":         "SKIPPED",
        "input_method":   "skipped",
    }
    update_set = {k: v for k, v in values.items() if k != "case_id"}
    update_set["updated_at"] = func.now()
    stmt = pg_insert(ItrVerification).values(**values).on_conflict_do_update(
        index_elements=["case_id"], set_=update_set,
    ).returning(ItrVerification)
    row = (await db.execute(stmt)).scalar_one()
    return {
        "case_uuid":       str(case.id),
        "verification_id": str(row.id),
        "status":          "SKIPPED",
    }
