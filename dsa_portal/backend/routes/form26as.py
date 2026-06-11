"""
Form 26AS verification — DSA mode.

Lender wants the Excel/PDF Perfios generates. We download both, store in
our GCS bucket (permanent), keep raw_response as audit fallback.
No aggregate computation — that's the lender's job.
"""

from typing import Any
import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.sql import func

from models.schemas import Form26ASRequest, Form26ASResponse, PersistenceInfo
from services.perfios import get_client, post
from services.verification import get_or_create_case
from security.crypto import encrypt, sha256_hex, last_n
from storage.gcs import build_doc_path, download_to_gcs, upload_bytes
from db.session import get_session
from db.models import Form26asVerification
from config import BASE_ITR

router = APIRouter(prefix="/26as", tags=["Form 26AS"])


@router.post("/fetch", response_model=Form26ASResponse)
async def fetch_26as(req: Form26ASRequest,
                     client: httpx.AsyncClient = Depends(get_client),
                     db: AsyncSession = Depends(get_session)):
    case = await get_or_create_case(db, case_id=req.case_id, pan=req.pan)

    payload = {
        "consent":    "Y",
        "username":   req.pan,
        "password":   req.password,        # pass-through, never stored
        "apiVersion": req.api_version,
        "source":     req.source,
        "years":      req.years,
    }
    try:
        result = await post(client, f"{BASE_ITR}/v1/itr-26as", payload, req.case_id)
    except httpx.HTTPStatusError as e:
        # Perfios upstream issue — return a clean error to the frontend instead
        # of letting it bubble up as 500 and causing a blank UI.
        if e.response.status_code in (502, 503, 504):
            raise HTTPException(
                status_code=502,
                detail=("Form 26AS service is temporarily unreachable on Perfios's side. "
                        "Please retry in a minute. (HTTP "
                        f"{e.response.status_code} on /v1/itr-26as)"),
            )
        # Anything else: surface Perfios's error body so we can debug
        raise HTTPException(
            status_code=502,
            detail=f"Perfios returned {e.response.status_code}: {e.response.text[:300]}",
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Could not reach Perfios: {type(e).__name__}",
        )

    code   = result.get("statusCode") or result.get("status-code")
    verified = str(code) == "101"

    r       = result.get("result") or {}
    profile = r.get("profile") or {}
    per_year = r.get("26asData") or []

    # Find the first non-empty status field across years
    status_of_26as = None
    for blk in per_year:
        if blk.get("statusOf26asData"):
            status_of_26as = blk.get("statusOf26asData")
            break

    pdf_url   = r.get("pdfDownloadLink") or None
    excel_url = r.get("excelDownloadLink") or None

    # Archive Perfios files to our bucket (permanent)
    pdf_ref   = await download_to_gcs(
        pdf_url,
        f"cases/{req.case_id}/form_26as/form_26as.pdf",
        content_type="application/pdf",
    ) if pdf_url else None
    excel_ref = await download_to_gcs(
        excel_url,
        f"cases/{req.case_id}/form_26as/form_26as.xlsx",
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ) if excel_url else None

    values = {
        "case_id":                    case.id,
        "pan_hash":                   sha256_hex(req.pan),
        "pan_ciphertext":             encrypt(req.pan),
        "pan_last_4":                 last_n(req.pan, 4),
        "source":                     req.source,
        "api_version":                req.api_version,
        "assessment_years_requested": req.years,

        "borrower_name":              profile.get("name"),
        "borrower_pan":               profile.get("pan"),
        "borrower_status":            profile.get("status"),
        "borrower_address":           profile.get("address"),

        "status_of_26as_data":        status_of_26as,

        "pdf_download_link":          pdf_url,
        "pdf_bucket_path":            r.get("pdfBucketPath") or None,
        "excel_download_link":        excel_url,
        "excel_bucket_path":          r.get("excelBucketPath") or None,
        "pdf_gcs_bucket":             pdf_ref.bucket   if pdf_ref   else None,
        "pdf_gcs_path":               pdf_ref.path     if pdf_ref   else None,
        "excel_gcs_bucket":           excel_ref.bucket if excel_ref else None,
        "excel_gcs_path":             excel_ref.path   if excel_ref else None,

        "status":                     "COMPLETED" if verified else "FAILED",
        "input_method":               "credentials",
        "perfios_status_code":        str(code) if code is not None else None,
        "perfios_request_id":         result.get("requestId") or result.get("request_id"),
        "error_code":                 None if verified else str(code),
        "error_reason":               None if verified else (result.get("error")
                                                              or result.get("message")
                                                              or "Verification failed"),
        "raw_response":               result,
    }

    update_set = {k: v for k, v in values.items() if k != "case_id"}
    update_set["updated_at"] = func.now()
    stmt = pg_insert(Form26asVerification).values(**values).on_conflict_do_update(
        index_elements=["case_id"], set_=update_set,
    ).returning(Form26asVerification)
    row = (await db.execute(stmt)).scalar_one()

    return Form26ASResponse(
        status_code = code,
        request_id  = result.get("requestId") or result.get("request_id"),
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
async def upload_26as_sheet(
    case_id: str        = Form(...),
    file:    UploadFile = File(...),
    db:      AsyncSession = Depends(get_session),
):
    """User uploads a Form 26AS document when they won't share IT-portal
    credentials. File goes to GCS; we record the link on form26as_verifications
    with input_method='upload'."""
    name = (file.filename or "").lower()
    ext  = next((e for e in _UPLOAD_ALLOWED_EXT if name.endswith(e)), None)
    if not ext:
        raise HTTPException(400, "Only PDF, DOC, DOCX, XLS, XLSX, or CSV files are accepted")

    content = await file.read()
    if not content:
        raise HTTPException(400, "Empty file")

    case = await get_or_create_case(db, case_id=case_id)
    gcs_path = build_doc_path(case_id, "form_26as_sheet", file.filename or f"26as{ext}")
    up = await upload_bytes(gcs_path, content,
                             file.content_type or "application/octet-stream")
    gcs_url = f"gs://{up.bucket}/{up.path}"

    values = {
        "case_id":                  case.id,
        # pan_hash/pan_ciphertext are NOT NULL — sentinel for no-PAN upload path.
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
    stmt = pg_insert(Form26asVerification).values(**values).on_conflict_do_update(
        index_elements=["case_id"], set_=update_set,
    ).returning(Form26asVerification)
    row = (await db.execute(stmt)).scalar_one()

    return {
        "case_uuid":       str(case.id),
        "verification_id": str(row.id),
        "status":          "UPLOADED",
        "gcs_url":         gcs_url,
        "filename":        file.filename,
        "size_bytes":      up.size_bytes,
    }


class Form26ASSkipRequest(BaseModel):
    case_id: str


@router.post("/skip")
async def skip_26as(req: Form26ASSkipRequest,
                     db: AsyncSession = Depends(get_session)):
    """User explicitly skipped both upload and credentials. Recorded for the
    lender and any future GST-based estimator to consume."""
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
    stmt = pg_insert(Form26asVerification).values(**values).on_conflict_do_update(
        index_elements=["case_id"], set_=update_set,
    ).returning(Form26asVerification)
    row = (await db.execute(stmt)).scalar_one()
    return {
        "case_uuid":       str(case.id),
        "verification_id": str(row.id),
        "status":          "SKIPPED",
    }
