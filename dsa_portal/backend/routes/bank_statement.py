"""
Bank Statement Analysis (BSA) — upload + Perfios verification.

POST /bsa/upload (multipart)
  1. Receive PDF + loan context
  2. Upload PDF to GCS (permanent)
  3. Call Perfios Insights API end-to-end:
       initiate txn → upload file → link statement → trigger report →
       poll until COMPLETED → fetch xlsx + json reports → archive both to GCS
  4. Extract tamper signals (statementStatus, suspiciousBankEStatements)
  5. Persist everything to bsa_verifications; return result to client

Client waits for the full result (~30–90 s). No polling needed on the client side.
"""

import asyncio
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func

from config import BASE_INSIGHTS
from db.models import BsaVerification
from db.session import get_session
from security.crypto import encrypt
from services.perfios import bsa_get, bsa_post, bsa_post_file, get_client
from services.verification import get_or_create_case
from storage.gcs import build_doc_path, upload_bytes

log = logging.getLogger(__name__)

router = APIRouter(prefix="/bsa", tags=["Bank Statement Analysis"])

_POLL_INTERVAL = 15   # seconds between status checks
_POLL_MAX      = 20   # max polls (~5 min total)


# ── Perfios BSA flow helpers ──────────────────────────────────────────────────

async def _initiate(client: httpx.AsyncClient, case_id: str,
                    loan_amount: int, loan_duration: int, loan_type: str) -> str:
    data = await bsa_post(client, f"{BASE_INSIGHTS}/transactions", {
        "loanAmount":               str(loan_amount or 0),
        "loanDuration":             str(loan_duration or 12),
        "loanType":                 loan_type or "Personal",
        "processingType":           "STATEMENT",
        "txnId":                    case_id[:64],
        "acceptancePolicy":         "atLeastOneTransactionInRange",
        "uploadingScannedStatements": "false",
    })
    return data["transaction"]["perfiosTransactionId"]


async def _upload_file(client: httpx.AsyncClient, txn_id: str,
                       file_bytes: bytes, filename: str) -> str:
    data = await bsa_post_file(client, f"{BASE_INSIGHTS}/transactions/{txn_id}/files",
                               file_bytes, filename)
    return data["file"]["fileId"]


async def _link_statement(client: httpx.AsyncClient, txn_id: str,
                           file_id: str, password: Optional[str]) -> None:
    payload = {"fileId": file_id}
    if password:
        payload["password"] = password
    await bsa_post(client, f"{BASE_INSIGHTS}/transactions/{txn_id}/bank-statements", payload)


async def _trigger_report(client: httpx.AsyncClient, txn_id: str) -> None:
    await bsa_post(client, f"{BASE_INSIGHTS}/transactions/{txn_id}/reports", {})


async def _poll_until_done(client: httpx.AsyncClient, txn_id: str) -> None:
    for _ in range(_POLL_MAX):
        await asyncio.sleep(_POLL_INTERVAL)
        try:
            resp = await bsa_get(client, f"{BASE_INSIGHTS}/transactions/{txn_id}/status")
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                continue
            raise
        txn    = (resp.json().get("transactions") or {}).get("transaction", [{}])
        txn    = txn[0] if isinstance(txn, list) else txn
        status = txn.get("status", "")
        if status == "COMPLETED":
            return
        if status in ("FAILED", "CANCELLED"):
            raise HTTPException(502, f"Perfios report {status}: {txn.get('reason','')}")
    raise HTTPException(504, "Perfios report timed out")


async def _fetch_report(client: httpx.AsyncClient, txn_id: str,
                        report_type: str) -> bytes:
    resp = await bsa_get(client, f"{BASE_INSIGHTS}/transactions/{txn_id}/reports",
                         params={"types": report_type})
    return resp.content


def _extract_tamper(report_json: dict) -> tuple[str | None, bool | None]:
    """Return (statement_status, is_suspicious)."""
    details = report_json.get("statementdetails") or []
    stmt_status = details[0].get("statementStatus") if details else None

    fraud = (report_json.get("fCUAnalysis") or {})
    suspicious_raw = (
        fraud
        .get("possibleFraudIndicators", {})
        .get("suspiciousBankEStatements", {})
        .get("status")
    )
    is_suspicious = (suspicious_raw == "true") if suspicious_raw is not None else None

    return stmt_status, is_suspicious


# ── Route ─────────────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_bank_statement(
    request:              Request,
    case_id:              str               = Form(...),
    file:                 UploadFile        = File(...),
    password:             Optional[str]     = Form(None),
    loan_amount:          Optional[int]     = Form(None),
    loan_duration_months: Optional[int]     = Form(None),
    loan_type:            Optional[str]     = Form(None),
    db:                   AsyncSession      = Depends(get_session),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are accepted")

    content = await file.read()
    if not content:
        raise HTTPException(400, "Empty file")

    try:
        case = await get_or_create_case(
            db, case_id=case_id,
            loan_amount=loan_amount, loan_type=loan_type,
        )
    except Exception as exc:
        log.error("BSA: DB case lookup failed for %s: %s", case_id, exc)
        raise HTTPException(503, "Database unavailable. Please try again later.")

    # Upload PDF to our GCS (permanent, regardless of Perfios outcome)
    gcs_path = build_doc_path(case_id, "bank_statement",
                               file.filename or "statement.pdf")
    try:
        up = await upload_bytes(gcs_path, content,
                                 file.content_type or "application/pdf")
    except Exception as exc:
        log.error("BSA: GCS upload failed for %s: %s", case_id, exc)
        raise HTTPException(503, "File storage unavailable. Please try again later.")

    try:
        pwd_ct = encrypt(password) if password else None
    except RuntimeError as exc:
        log.error("BSA: Encryption config error: %s", exc)
        raise HTTPException(500, "Encryption not configured. Contact support.")

    # ── Perfios BSA flow ──────────────────────────────────────────────────────
    client = get_client(request)
    perfios_txn_id      = None
    statement_status    = None
    is_suspicious       = None
    xlsx_up             = None
    json_up             = None
    raw_json            = None
    bsa_status          = "UPLOADED"
    error_code          = None
    error_reason        = None
    perfios_error_code  = None

    try:
        perfios_txn_id = await _initiate(
            client, case_id,
            loan_amount or 0, loan_duration_months or 12, loan_type or "Personal",
        )
        log.info("BSA txn initiated: %s for case %s", perfios_txn_id, case_id)

        file_id = await _upload_file(client, perfios_txn_id, content,
                                      file.filename or "statement.pdf")

        await _link_statement(client, perfios_txn_id, file_id, password)

        await _trigger_report(client, perfios_txn_id)

        await _poll_until_done(client, perfios_txn_id)

        # Fetch reports and archive to GCS
        xlsx_bytes = await _fetch_report(client, perfios_txn_id, "xlsx")
        json_bytes = await _fetch_report(client, perfios_txn_id, "json")

        import json as _json
        raw_json = _json.loads(json_bytes)
        statement_status, is_suspicious = _extract_tamper(raw_json)

        xlsx_up = await upload_bytes(
            f"cases/{case_id}/bank_statement/report_{perfios_txn_id}.xlsx",
            xlsx_bytes,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        json_up = await upload_bytes(
            f"cases/{case_id}/bank_statement/report_{perfios_txn_id}.json",
            json_bytes,
            "application/json",
        )
        bsa_status = "COMPLETED"
        log.info("BSA completed for case %s: statementStatus=%s suspicious=%s",
                 case_id, statement_status, is_suspicious)

    except HTTPException:
        raise
    except Exception as exc:
        log.error("BSA Perfios flow failed for case %s: %s", case_id, exc)
        bsa_status = "FAILED"
        error_code = type(exc).__name__

        # Extract human-readable Perfios error when available
        perfios_error_code = None
        if isinstance(exc, httpx.HTTPStatusError):
            try:
                body    = exc.response.json()
                err     = body.get("error") or {}
                details = err.get("details") or []
                perfios_error_code = (details[0].get("code") if details
                                      else err.get("code"))
                error_reason = (details[0].get("message") if details
                                else err.get("message") or str(exc)[:500])
            except Exception:
                error_reason = str(exc)[:500]
        else:
            error_reason = str(exc)[:500]

    # ── Persist ───────────────────────────────────────────────────────────────
    values = {
        "case_id":                  case.id,
        "loan_amount":              loan_amount,
        "loan_duration_months":     loan_duration_months,
        "loan_type":                loan_type,
        "pdf_gcs_bucket":           up.bucket,
        "pdf_gcs_path":             up.path,
        "pdf_content_type":         up.content_type,
        "pdf_size_bytes":           up.size_bytes,
        "pdf_sha256":               up.sha256,
        "pdf_original_filename":    file.filename,
        "pdf_password_ciphertext":  pwd_ct,
        "statement_status":         statement_status,
        "is_suspicious_e_statement": is_suspicious,
        "xlsx_gcs_bucket":          xlsx_up.bucket if xlsx_up else None,
        "xlsx_gcs_path":            xlsx_up.path   if xlsx_up else None,
        "json_report_gcs_bucket":   json_up.bucket if json_up else None,
        "json_report_gcs_path":     json_up.path   if json_up else None,
        "status":                   bsa_status,
        "error_code":               error_code,
        "error_reason":             error_reason,
        "perfios_transaction_id":   perfios_txn_id,
        "raw_response":             raw_json,
    }
    update_set = {k: v for k, v in values.items() if k != "case_id"}
    update_set["updated_at"] = func.now()

    stmt = pg_insert(BsaVerification).values(**values).on_conflict_do_update(
        index_elements=["case_id"], set_=update_set,
    ).returning(BsaVerification)
    try:
        row = (await db.execute(stmt)).scalar_one()
    except Exception as exc:
        log.error("BSA: DB persist failed for %s: %s", case_id, exc)
        raise HTTPException(503, "Failed to save results. Please try again later.")

    if bsa_status == "FAILED":
        _ERROR_MESSAGES = {
            "E_FILE_NOT_STATEMENT":             "This file doesn't appear to be a bank statement. Please upload a valid bank statement PDF.",
            "E_FILE_NO_PASSWORD":               "This PDF is password-protected. Please enter the PDF password and try again.",
            "E_FILE_WRONG_PASSWORD":            "Incorrect PDF password. Please re-enter the correct password.",
            "E_DATE_RANGE":                     "No transactions found in the required date range. Please upload a more recent statement (last 6–12 months).",
            "E_STATEMENT_UNSUPPORTED_FORMAT":   "This bank statement format is not supported. Please upload a PDF downloaded directly from your bank's internet banking portal.",
            "E_STATEMENT_NO_INSTITUTION_MATCHED": "We couldn't identify your bank from this statement. Please upload the statement as downloaded from your bank's website.",
            "E_STATEMENT_WRONG_INSTITUTION":    "The statement doesn't match the selected bank. Please upload the correct bank's statement.",
            "E_STATEMENT_AMBIGUOUS_INSTITUTION": "The statement format matches multiple banks. Please upload a statement directly from your bank's internet banking portal.",
            "CannotProcessFile":                "This file doesn't appear to be a valid bank statement. Please upload a PDF bank statement.",
            "FileTooLarge":                     "The file is too large. Please upload a smaller bank statement PDF.",
            "UnsupportedFileType":              "Only PDF files are accepted. Please upload your bank statement as a PDF.",
        }
        detail = _ERROR_MESSAGES.get(perfios_error_code or "") or error_reason or "Bank statement processing failed. Please try again."
        raise HTTPException(status_code=422, detail=detail)

    return {
        "case_uuid":                str(case.id),
        "verification_id":          str(row.id),
        "status":                   bsa_status,
        "perfios_transaction_id":   perfios_txn_id,
        "statement_status":         statement_status,
        "is_suspicious_e_statement": is_suspicious,
        "tamper_verified":          statement_status == "VERIFIED" and is_suspicious is False,
        "gcs_pdf":                  f"gs://{up.bucket}/{up.path}",
        "gcs_xlsx":                 f"gs://{xlsx_up.bucket}/{xlsx_up.path}" if xlsx_up else None,
        "gcs_json":                 f"gs://{json_up.bucket}/{json_up.path}" if json_up else None,
        "error_code":               error_code,
        "error_reason":             error_reason,
    }
