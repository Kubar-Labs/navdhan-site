"""
Case-centric verification helpers. During the journey, case_id is the sole
identity. PII (pan, aadhaar_hash, name) is stored on `cases` directly.
No borrower upsert at runtime — borrowers are reconciled out-of-band later.
"""

import hashlib
from typing import Optional, Any
from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Case, Document, Verification, PanVerification
from security.crypto import encrypt, sha256_hex, last_n
from storage.gcs import UploadResult


def aadhaar_hash(aadhaar_no: str) -> str:
    return hashlib.sha256(aadhaar_no.encode("utf-8")).hexdigest()


async def get_or_create_case(db: AsyncSession, *, case_id: str,
                             pan: Optional[str] = None,
                             aadhaar_no: Optional[str] = None,
                             borrower_name: Optional[str] = None,
                             loan_amount: Optional[int] = None,
                             loan_type: Optional[str] = None) -> Case:
    """
    Find the case by `case_id`; create if missing. Any PII provided fills in
    gaps on the existing row (never overwrites). Safe to call from every route.
    """
    hashed = aadhaar_hash(aadhaar_no) if aadhaar_no else None

    row = (await db.execute(
        select(Case).where(Case.case_id == case_id)
    )).scalar_one_or_none()

    if row is None:
        row = Case(
            case_id=case_id, pan=pan, aadhaar_hash=hashed,
            borrower_name=borrower_name,
            loan_amount=loan_amount, loan_type=loan_type,
        )
        db.add(row)
        await db.flush()
        return row

    # Fill gaps without overwriting
    if pan and not row.pan:                         row.pan           = pan
    if hashed and not row.aadhaar_hash:             row.aadhaar_hash  = hashed
    if borrower_name and not row.borrower_name:     row.borrower_name = borrower_name
    if loan_amount and not row.loan_amount:         row.loan_amount   = loan_amount
    if loan_type and not row.loan_type:             row.loan_type     = loan_type
    await db.flush()
    return row


async def record_document(db: AsyncSession, *, case_pk, doc_type: str,
                          upload: UploadResult) -> Document:
    """Upsert a document — UNIQUE(case_id, doc_type) keeps one per type."""
    stmt = pg_insert(Document).values(
        case_id=case_pk, doc_type=doc_type,
        gcs_bucket=upload.bucket, gcs_path=upload.path,
        content_type=upload.content_type, size_bytes=upload.size_bytes,
        sha256=upload.sha256,
    ).on_conflict_do_update(
        index_elements=["case_id", "doc_type"],
        set_={"gcs_bucket":   upload.bucket,
              "gcs_path":     upload.path,
              "content_type": upload.content_type,
              "size_bytes":   upload.size_bytes,
              "sha256":       upload.sha256},
    ).returning(Document)
    return (await db.execute(stmt)).scalar_one()


async def record_verification(db: AsyncSession, *, case_pk, v_type: str,
                              status: str, result_json: Any = None,
                              perfios_txn_id: Optional[str] = None,
                              error_code: Optional[str] = None,
                              error_reason: Optional[str] = None,
                              pan_aadhaar_linked: Optional[bool] = None) -> Verification:
    """Upsert a verification — UNIQUE(case_id, type) is the idempotency key."""
    values = dict(
        case_id=case_pk, type=v_type, status=status,
        result_json=result_json, perfios_txn_id=perfios_txn_id,
        error_code=error_code, error_reason=error_reason,
    )
    update_set = {"status":         status,
                  "result_json":    result_json,
                  "perfios_txn_id": perfios_txn_id,
                  "error_code":     error_code,
                  "error_reason":   error_reason,
                  "updated_at":     func.now()}

    if pan_aadhaar_linked is not None:
        values["pan_aadhaar_linked"] = pan_aadhaar_linked
        update_set["pan_aadhaar_linked"] = pan_aadhaar_linked

    stmt = pg_insert(Verification).values(**values).on_conflict_do_update(
        index_elements=["case_id", "type"], set_=update_set,
    ).returning(Verification)
    return (await db.execute(stmt)).scalar_one()


async def upsert_pan_link(db: AsyncSession, *, case_pk, pan: str,
                           name: Optional[str], linked: bool,
                           link_response: Any) -> PanVerification:
    """
    Patch the `pan_verifications` row for this case with the link-check outcome.
    If a row doesn't exist yet (e.g. /pan/link hit before /pan/verify's
    background persist finished), creates a minimal one — a later /pan/verify
    persist will fill in the verification fields without wiping the link.
    """
    values = dict(
        case_id                     = case_pk,
        pan_hash                    = sha256_hex(pan),
        pan_ciphertext              = encrypt(pan),
        pan_last_4                  = last_n(pan, 4),
        borrower_name_input         = name,
        status                      = "LINK_CHECKED",
        pan_aadhaar_linked          = linked,
        pan_aadhaar_link_checked_at = func.now(),
        pan_aadhaar_link_response   = link_response,
    )
    stmt = pg_insert(PanVerification).values(**values).on_conflict_do_update(
        index_elements=["case_id"],
        set_={
            "pan_aadhaar_linked":          linked,
            "pan_aadhaar_link_checked_at": func.now(),
            "pan_aadhaar_link_response":   link_response,
            "updated_at":                  func.now(),
        },
    ).returning(PanVerification)
    return (await db.execute(stmt)).scalar_one()
