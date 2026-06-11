"""
Aadhaar verification via Perfios v3/aadhaar-mobilelink.

  POST /aadhaar/verify  (multipart form)
    form: aadhaar_no, mobile, case_id, [loan_amount], [loan_type]

Foreground: calls Perfios → checks validId ("Yes"/"No") to confirm the
            Aadhaar number is genuine.
Background: upsert case + aadhaar_verifications row.

Name is no longer collected here — UIDAI does not expose it via this API.
Authoritative borrower name is captured from PAN authority in the PAN step.
"""

import logging
import httpx
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Form

from models.schemas import AadhaarVerifyResponse, PersistenceInfo
from services.perfios import get_client, post
from services.persist import persist_aadhaar_result
from config import BASE_KYC

log = logging.getLogger(__name__)
router = APIRouter(prefix="/aadhaar", tags=["Aadhaar"])


@router.post("/verify", response_model=AadhaarVerifyResponse)
async def verify_aadhaar(
    background_tasks: BackgroundTasks,
    aadhaar_no:  str               = Form(..., min_length=12, max_length=12),
    mobile:      str               = Form(..., min_length=10, max_length=10),
    case_id:     str               = Form(...),
    loan_amount: Optional[int]     = Form(None),
    loan_type:   Optional[str]     = Form(None),
    client:      httpx.AsyncClient = Depends(get_client),
):
    payload = {
        "consent": "Y",
        "mobile":  mobile,
        "aadhaar": aadhaar_no,
    }
    try:
        result = await post(client, f"{BASE_KYC}/v3/aadhaar-mobilelink", payload, case_id)
    except httpx.HTTPStatusError as e:
        background_tasks.add_task(
            persist_aadhaar_result,
            case_id=case_id, aadhaar_no=aadhaar_no, mobile=mobile,
            loan_amount=loan_amount, loan_type=loan_type,
            perfios_result={"error": e.response.text[:500]},
            verified=False, perfios_code=e.response.status_code,
        )
        raise HTTPException(status_code=502, detail=f"Perfios error: {e.response.text}")

    raw_r        = result.get("result")
    r            = raw_r if raw_r is not None else result
    perfios_code = result.get("statusCode") or result.get("status-code")

    log.info("aadhaar-mobilelink case=%s statusCode=%s result=%s", case_id, perfios_code, r)

    # Perfios returns "Yes"/"No" strings
    valid_id          = r.get("validId")          or r.get("valid_id")
    is_mobile_linked  = r.get("isMobileLinked")   or r.get("is_mobile_linked")
    is_verified       = r.get("isVerified")        or r.get("is_verified")

    valid_id_ok      = (valid_id or "").lower() == "yes"
    mobile_linked_ok = (is_mobile_linked or "").lower() == "yes"
    verified = valid_id_ok and mobile_linked_ok

    if not verified:
        background_tasks.add_task(
            persist_aadhaar_result,
            case_id=case_id, aadhaar_no=aadhaar_no, mobile=mobile,
            loan_amount=loan_amount, loan_type=loan_type,
            perfios_result=result, verified=False, perfios_code=perfios_code,
        )
        if valid_id_ok and not mobile_linked_ok:
            detail = ("Mobile number is not linked to this Aadhaar. "
                      "Please enter the mobile number registered with UIDAI.")
        else:
            detail = "Aadhaar could not be verified. Please check your Aadhaar number and try again."
        raise HTTPException(status_code=422, detail=detail)

    background_tasks.add_task(
        persist_aadhaar_result,
        case_id=case_id, aadhaar_no=aadhaar_no, mobile=mobile,
        loan_amount=loan_amount, loan_type=loan_type,
        perfios_result=result, verified=verified, perfios_code=perfios_code,
    )

    return AadhaarVerifyResponse(
        status_code      = perfios_code,
        request_id       = result.get("requestId") or result.get("request_id"),
        valid_id         = valid_id,
        is_mobile_linked = is_mobile_linked,
        is_verified      = is_verified,
        raw              = result,
        persistence      = PersistenceInfo(verified=verified),
    )
