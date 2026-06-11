"""
Background persistence — runs after the response is sent. Writes to
cases + documents + verifications. Never touches borrowers.
"""

import hashlib
import logging
from typing import Any, Optional
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.sql import func

from db.session import new_session
from db.models import AadhaarVerification, PanVerification
from security.crypto import encrypt, sha256_hex, last_n
from services.verification import (get_or_create_case, record_document,
                                    record_verification)

log = logging.getLogger("persist")


async def persist_aadhaar_result(*, case_id: str, aadhaar_no: str, mobile: str,
                                  loan_amount: Optional[int],
                                  loan_type: Optional[str],
                                  perfios_result: Any,
                                  verified: bool,
                                  perfios_code: Any) -> None:
    """Write to cases + aadhaar_verifications. Aadhaar # is hashed AND encrypted."""
    try:
        async with new_session() as db:
            case = await get_or_create_case(db, case_id=case_id,
                                             aadhaar_no=aadhaar_no,
                                             loan_amount=loan_amount,
                                             loan_type=loan_type)

            r = (perfios_result or {}).get("result") or perfios_result or {}
            values = dict(
                case_id            = case.id,
                aadhaar_hash       = sha256_hex(aadhaar_no),
                aadhaar_ciphertext = encrypt(aadhaar_no),
                aadhaar_last_4     = last_n(aadhaar_no, 4),
                mobile_input       = mobile,
                valid_id           = r.get("validId")        or r.get("valid_id"),
                is_mobile_linked   = r.get("isMobileLinked") or r.get("is_mobile_linked"),
                is_verified_mobile = r.get("isVerified")      or r.get("is_verified"),
                status             = "COMPLETED" if verified else "FAILED",
                perfios_status_code= str(perfios_code) if perfios_code is not None else None,
                perfios_request_id = (perfios_result or {}).get("requestId")
                                      or (perfios_result or {}).get("request_id"),
                error_code         = None if verified else str(perfios_code),
                error_reason       = None if verified else
                                      ((perfios_result or {}).get("message") or "Verification failed"),
                raw_response       = perfios_result,
            )

            # Upsert by UNIQUE(case_id) — retry overwrites, no duplicate rows
            update_set = {k: v for k, v in values.items() if k != "case_id"}
            update_set["updated_at"] = func.now()
            stmt = pg_insert(AadhaarVerification).values(**values).on_conflict_do_update(
                index_elements=["case_id"], set_=update_set,
            )
            await db.execute(stmt)
            await db.commit()
    except Exception as e:
        log.exception("aadhaar background persist failed for case_id=%s: %s",
                      case_id, e)


async def persist_pan_result(*, case_id: str, pan: str,
                              name: Optional[str],
                              loan_amount: Optional[int],
                              loan_type: Optional[str],
                              perfios_result: Any,
                              verified: bool,
                              perfios_code: Any,
                              perfios_name: Optional[str]) -> None:
    """Write to cases + pan_verifications. PAN is hashed AND encrypted."""
    try:
        async with new_session() as db:
            case = await get_or_create_case(db, case_id=case_id,
                                             pan=pan,
                                             borrower_name=perfios_name or name,
                                             loan_amount=loan_amount,
                                             loan_type=loan_type)

            values = dict(
                case_id             = case.id,
                pan_hash            = sha256_hex(pan),
                pan_ciphertext      = encrypt(pan),
                pan_last_4          = last_n(pan, 4),
                borrower_name_input = name,
                borrower_name       = perfios_name,
                status              = "COMPLETED" if verified else "FAILED",
                perfios_status_code = str(perfios_code) if perfios_code is not None else None,
                perfios_request_id  = (perfios_result or {}).get("request_id")
                                       or (perfios_result or {}).get("requestId"),
                error_code          = None if verified else str(perfios_code),
                error_reason        = None if verified else
                                        ((perfios_result or {}).get("message") or "Verification failed"),
                raw_response        = perfios_result,
            )

            # Upsert by UNIQUE(case_id). Retry overwrites the verification
            # fields but DOES NOT wipe a pan_aadhaar_link that /pan/link
            # may have already stored for this case.
            update_set = {k: v for k, v in values.items() if k != "case_id"}
            update_set["updated_at"] = func.now()
            stmt = pg_insert(PanVerification).values(**values).on_conflict_do_update(
                index_elements=["case_id"], set_=update_set,
            )
            await db.execute(stmt)
            await db.commit()
    except Exception as e:
        log.exception("pan background persist failed for case_id=%s: %s",
                      case_id, e)
