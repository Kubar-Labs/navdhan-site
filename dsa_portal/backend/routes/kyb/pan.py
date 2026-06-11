"""
Business-PAN endpoints. Each one writes to its own dedicated table — keeps
KYB data partitioned per verification type (same shape as the individual flow).

  POST /kyb/pan/verify      → kyb_pan_verifications   (Perfios KYC /v2/pan)
  POST /kyb/pan/cin-llpin   → kyb_cin_verifications   (Perfios KSCAN /v3/pan-cin)
  POST /kyb/pan/gst-by-pan  → kyb_gst_searches        (Perfios GST /v2/search)
"""

import logging
from typing import Any, Optional
import httpx
from fastapi import APIRouter, Depends, Form, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.sql import func
from sqlalchemy.ext.asyncio import AsyncSession

from config import BASE_KSCAN, BASE_GST, BASE_KYC
from db.session import get_session
from db.models import KybPanVerification, KybCinVerification, KybGstSearch
from security.crypto import encrypt, sha256_hex, last_n
from services.perfios import get_client, post
from services.verification import get_or_create_case

log = logging.getLogger(__name__)

router = APIRouter(prefix="/kyb", tags=["KYB"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class _BusinessPanRequest(BaseModel):
    pan:     str = Field(..., min_length=10, max_length=10)
    case_id: str = Field(..., min_length=1)


class KybPanVerifyResponse(BaseModel):
    status_code: Optional[str] = None
    request_id:  Optional[str] = None
    name:        Optional[str] = None
    raw:         Any = None


class CinLlpinResult(BaseModel):
    entity_id: Optional[str] = None
    name:      Optional[str] = None


class CinLlpinResponse(BaseModel):
    status_code: Optional[str] = None
    request_id:  Optional[str] = None
    results:     list[CinLlpinResult] = []
    raw:         Any = None


class GstSearchHit(BaseModel):
    gstin_id:           Optional[str] = None
    state:              Optional[str] = None
    auth_status:        Optional[str] = None
    application_status: Optional[str] = None
    registration_name:  Optional[str] = None
    pan:                Optional[str] = None


class GstByPanResponse(BaseModel):
    status_code: Optional[str] = None
    request_id:  Optional[str] = None
    count:       int = 0
    results:     list[GstSearchHit] = []
    raw:         Any = None


# ── Generic upsert helper (one row per case_id in any KYB table) ──────────────

async def _upsert(db: AsyncSession, model, *, case_pk, pan: str, values: dict) -> None:
    base = dict(
        case_id        = case_pk,
        pan_hash       = sha256_hex(pan),
        pan_ciphertext = encrypt(pan),
        pan_last_4     = last_n(pan, 4),
    )
    row = {**base, **values}
    update_set = {k: v for k, v in row.items() if k != "case_id"}
    update_set["updated_at"] = func.now()
    stmt = pg_insert(model).values(**row).on_conflict_do_update(
        index_elements=["case_id"], set_=update_set,
    )
    await db.execute(stmt)


# ── PAN authentication (business path) ───────────────────────────────────────

@router.post("/pan/verify", response_model=KybPanVerifyResponse)
async def kyb_verify_pan(
    pan:         str           = Form(..., min_length=10, max_length=10),
    case_id:     str           = Form(...),
    name:        Optional[str] = Form(None),
    loan_amount: Optional[int] = Form(None),
    loan_type:   Optional[str] = Form(None),
    client:      httpx.AsyncClient = Depends(get_client),
    db:          AsyncSession  = Depends(get_session),
):
    pan = pan.upper().strip()
    case = await get_or_create_case(
        db, case_id=case_id, pan=pan,
        borrower_name=name, loan_amount=loan_amount, loan_type=loan_type,
    )

    payload = {"consent": "Y", "pan": pan}
    try:
        result = await post(client, f"{BASE_KYC}/v2/pan", payload, case_id)
    except httpx.HTTPStatusError as e:
        await _upsert(db, KybPanVerification, case_pk=case.id, pan=pan, values=dict(
            status              = "error",
            perfios_status_code = str(e.response.status_code),
            error_code          = str(e.response.status_code),
            error_reason        = e.response.text[:500],
            raw_response        = {"error": str(e.response.status_code)},
        ))
        await db.commit()
        detail = ("Verification service is temporarily unavailable. Please try again."
                  if e.response.status_code >= 500
                  else "PAN verification failed. Please check your details and try again.")
        raise HTTPException(status_code=502, detail=detail)

    r            = result.get("result") or {}
    perfios_name = r.get("name") or result.get("name")
    perfios_code = result.get("status-code") or result.get("statusCode")
    verified     = str(perfios_code) == "101"
    request_id   = result.get("request_id") or result.get("requestId")

    await _upsert(db, KybPanVerification, case_pk=case.id, pan=pan, values=dict(
        entity_name         = perfios_name,
        status              = "verified" if verified else "failed",
        perfios_request_id  = request_id,
        perfios_status_code = str(perfios_code) if perfios_code is not None else None,
        error_code          = None if verified else (str(perfios_code) if perfios_code is not None else None),
        error_reason        = None if verified else (result.get("message") or "Verification failed"),
        raw_response        = result,
    ))
    await db.commit()

    if not verified:
        raise HTTPException(
            status_code=422,
            detail="PAN could not be verified. Please check your PAN number and try again.",
        )

    return KybPanVerifyResponse(
        status_code = str(perfios_code) if perfios_code is not None else None,
        request_id  = request_id,
        name        = perfios_name,
        raw         = result,
    )


# ── PAN → CIN/LLPIN ───────────────────────────────────────────────────────────

@router.post("/pan/cin-llpin", response_model=CinLlpinResponse)
async def pan_to_cin_llpin(req: _BusinessPanRequest,
                            client: httpx.AsyncClient = Depends(get_client),
                            db: AsyncSession = Depends(get_session)):
    case = await get_or_create_case(db, case_id=req.case_id, pan=req.pan)

    payload = {"pan": req.pan}
    try:
        result = await post(client, f"{BASE_KSCAN}/v3/pan-cin", payload, req.case_id)
    except httpx.HTTPStatusError as e:
        await _upsert(db, KybCinVerification, case_pk=case.id, pan=req.pan, values=dict(
            status              = "error",
            perfios_status_code = str(e.response.status_code),
            error_code          = str(e.response.status_code),
            error_reason        = e.response.text[:500],
            raw_response        = {"error": str(e.response.status_code)},
        ))
        await db.commit()
        detail = ("Verification service is temporarily unavailable. Please try again."
                  if e.response.status_code >= 500
                  else "CIN/LLPIN lookup failed. Please check the PAN and try again.")
        raise HTTPException(status_code=502, detail=detail)

    status_code = result.get("statusCode") or result.get("status-code")
    request_id  = result.get("requestId")  or result.get("request_id")
    raw_results = result.get("result") or []
    if isinstance(raw_results, dict):
        raw_results = [raw_results]
    first = raw_results[0] if raw_results else {}

    found = str(status_code) == "101" and bool(first.get("entityId"))

    await _upsert(db, KybCinVerification, case_pk=case.id, pan=req.pan, values=dict(
        cin_llpin           = first.get("entityId"),
        entity_name         = first.get("name"),
        status              = "found" if found else "not_found",
        perfios_request_id  = request_id,
        perfios_status_code = str(status_code) if status_code is not None else None,
        error_code          = None if found else (str(status_code) if status_code is not None else None),
        error_reason        = None if found else (result.get("message") or "No CIN/LLPIN found for this PAN"),
        raw_response        = result,
    ))
    await db.commit()

    if not found:
        raise HTTPException(
            status_code=422,
            detail="No CIN/LLPIN found for this PAN. Confirm the entity PAN is correct.",
        )

    results = [CinLlpinResult(entity_id=r.get("entityId"), name=r.get("name"))
               for r in raw_results]
    return CinLlpinResponse(
        status_code = str(status_code) if status_code is not None else None,
        request_id  = request_id,
        results     = results,
        raw         = result,
    )


# ── GST Search by PAN ─────────────────────────────────────────────────────────

@router.post("/pan/gst-by-pan", response_model=GstByPanResponse)
async def gst_by_pan(req: _BusinessPanRequest,
                      client: httpx.AsyncClient = Depends(get_client),
                      db: AsyncSession = Depends(get_session)):
    case = await get_or_create_case(db, case_id=req.case_id, pan=req.pan)

    payload = {"consent": "Y", "pan": req.pan}
    try:
        result = await post(client, f"{BASE_GST}/v2/search", payload, req.case_id)
    except httpx.HTTPStatusError as e:
        await _upsert(db, KybGstSearch, case_pk=case.id, pan=req.pan, values=dict(
            status              = "error",
            perfios_status_code = str(e.response.status_code),
            error_code          = str(e.response.status_code),
            error_reason        = e.response.text[:500],
            raw_response        = {"error": str(e.response.status_code)},
        ))
        await db.commit()
        detail = ("Verification service is temporarily unavailable. Please try again."
                  if e.response.status_code >= 500
                  else "GST search failed. Please check the PAN and try again.")
        raise HTTPException(status_code=502, detail=detail)

    status_code = result.get("statusCode") or result.get("status-code")
    request_id  = result.get("requestId")  or result.get("request_id")
    raw_results = result.get("result") or []
    if isinstance(raw_results, dict):
        raw_results = [raw_results]

    gstin_ids = [r.get("gstinId") for r in raw_results if r.get("gstinId")]
    found = str(status_code) == "101" and len(gstin_ids) > 0

    await _upsert(db, KybGstSearch, case_pk=case.id, pan=req.pan, values=dict(
        gstins              = raw_results,
        gstin_ids           = gstin_ids,
        gstin_count         = len(gstin_ids),
        status              = "found" if found else "not_found",
        perfios_request_id  = request_id,
        perfios_status_code = str(status_code) if status_code is not None else None,
        error_code          = None if found else (str(status_code) if status_code is not None else None),
        error_reason        = None if found else (result.get("message") or "No GSTIN found for this PAN"),
        raw_response        = result,
    ))
    await db.commit()

    hits = [
        GstSearchHit(
            gstin_id           = r.get("gstinId"),
            state              = r.get("state"),
            auth_status        = r.get("authStatus"),
            application_status = r.get("applicationStatus"),
            registration_name  = r.get("registrationName"),
            pan                = r.get("pan"),
        )
        for r in raw_results
    ]
    return GstByPanResponse(
        status_code = str(status_code) if status_code is not None else None,
        request_id  = request_id,
        count       = len(gstin_ids),
        results     = hits,
        raw         = result,
    )
