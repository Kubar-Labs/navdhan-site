"""
PAN verification.

  POST /pan/verify  (multipart form)
    form: pan, case_id, [name], [loan_amount], [loan_type]
    → foreground: Perfios /v2/pan. Background: case/document/verification writes.

  POST /pan/link    (json)
    fields: pan, aadhaar_no, name, case_id, consent_text
    → writes/updates the `pan` verification row's pan_aadhaar_linked flag.
"""

import time
import httpx
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Form
from sqlalchemy.ext.asyncio import AsyncSession

from models.schemas import (PANVerifyResponse, PANLinkRequest, PANLinkResponse,
                             PersistenceInfo)
from services.perfios import get_client, post
from services.persist import persist_pan_result
from services.verification import (get_or_create_case, upsert_pan_link)
from db.session import get_session
from config import BASE_KYC

router = APIRouter(prefix="/pan", tags=["PAN"])


@router.post("/verify", response_model=PANVerifyResponse)
async def verify_pan(
    background_tasks: BackgroundTasks,
    pan:         str                = Form(..., min_length=10, max_length=10),
    case_id:     str                = Form(...),
    name:        Optional[str]      = Form(None),
    loan_amount: Optional[int]      = Form(None),
    loan_type:   Optional[str]      = Form(None),
    client:      httpx.AsyncClient  = Depends(get_client),
):
    payload = {"consent": "Y", "pan": pan}
    try:
        result = await post(client, f"{BASE_KYC}/v2/pan", payload, case_id)
    except httpx.HTTPStatusError as e:
        background_tasks.add_task(
            persist_pan_result,
            case_id=case_id, pan=pan, name=name,
            loan_amount=loan_amount, loan_type=loan_type,
            perfios_result={"error": str(e.response.status_code)},
            verified=False, perfios_code=e.response.status_code,
            perfios_name=None,
        )
        code = e.response.status_code
        if code >= 500:
            detail = "Verification service is temporarily unavailable. Please try again in a moment."
        else:
            detail = "PAN verification failed. Please check your details and try again."
        raise HTTPException(status_code=502, detail=detail)

    r             = result.get("result") or {}
    perfios_name  = r.get("name") or result.get("name")
    perfios_code  = result.get("status-code") or result.get("statusCode")
    verified      = perfios_code in (101, "101")

    background_tasks.add_task(
        persist_pan_result,
        case_id=case_id, pan=pan, name=name,
        loan_amount=loan_amount, loan_type=loan_type,
        perfios_result=result, verified=verified,
        perfios_code=perfios_code, perfios_name=perfios_name,
    )

    if not verified:
        raise HTTPException(
            status_code=422,
            detail="PAN could not be verified. Please check your PAN number and try again.",
        )

    return PANVerifyResponse(
        status_code=perfios_code,
        request_id =result.get("request_id") or result.get("requestId"),
        name       =perfios_name,
        raw        =result,
        persistence=PersistenceInfo(verified=verified),
    )


async def _share_consent(client: httpx.AsyncClient, req: PANLinkRequest,
                         http_req: Request) -> str:
    client_ip  = http_req.client.host if http_req.client else "0.0.0.0"
    user_agent = http_req.headers.get("user-agent", "")
    payload = {
        "consent":     "Y",
        "ipAddress":   client_ip,
        "userAgent":   user_agent,
        "name":        req.name,
        "consentTime": str(int(time.time())),
        "consentText": req.consent_text,
        "clientData":  {"caseId": req.case_id},
        "caseId":      req.case_id,
    }
    result = await post(client, f"{BASE_KYC}/v3/aadhaar-consent", payload, req.case_id)
    access_key = (result.get("result") or {}).get("accessKey") or result.get("accessKey")
    if not access_key:
        raise HTTPException(status_code=502, detail=f"Consent step failed: {result}")
    return access_key


@router.post("/link", response_model=PANLinkResponse)
async def check_pan_aadhaar_link(req: PANLinkRequest,
                                  http_req: Request,
                                  client: httpx.AsyncClient = Depends(get_client),
                                  db: AsyncSession = Depends(get_session)):
    # Case-centric: the journey identity is the case_id. Fill in PII on the case row.
    case = await get_or_create_case(db, case_id=req.case_id,
                                     pan=req.pan, aadhaar_no=req.aadhaar_no,
                                     borrower_name=req.name)

    access_key = await _share_consent(client, req, http_req)
    payload = {
        "consent":    "Y",
        "pan":        req.pan,
        "aadhaarNo":  req.aadhaar_no,
        "accessKey":  access_key,
        "clientData": {"caseId": req.case_id},
        "caseId":     req.case_id,
    }
    result = await post(client, f"{BASE_KYC}/v3/pan-aadhaar-link", payload, req.case_id)
    r      = result.get("result") or {}
    linked = bool(r.get("linked"))

    v = await upsert_pan_link(db, case_pk=case.id, pan=req.pan,
                               name=req.name, linked=linked, link_response=result)

    if not linked:
        raise HTTPException(
            status_code=422,
            detail="PAN and Aadhaar are not linked. Both documents must belong to the same individual.",
        )

    return PANLinkResponse(
        status_code=result.get("statusCode") or result.get("status-code"),
        request_id =result.get("requestId")  or result.get("request_id"),
        message    =r.get("message") or result.get("message"),
        linked     =linked,
        raw        =result,
        persistence=PersistenceInfo(
            case_uuid      =str(case.id),
            verification_id=str(v.id),
            verified       =linked,
        ),
    )
