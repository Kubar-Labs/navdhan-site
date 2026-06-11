"""
Case lifecycle endpoints.

  POST /cases/start
    Body: { borrower_name, consent_text, consent_version? }
    Headers: real client IP + User-Agent (auto-captured)

    - Generates a unique case_id (LOAN-YYYYMMDD-{6-hex})
    - Creates row in `cases` (status=pending, borrower_name set)
    - Creates row in `case_consents` (audit-ready record)
    - Returns case_id + case_uuid to the frontend

The frontend uses the returned case_id for every subsequent verification step.
"""

import secrets
from datetime import datetime
from typing import Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from db.session import get_session
from db.models import Case, CaseConsent

router = APIRouter(prefix="/cases", tags=["Cases"])

MAX_GENERATION_RETRIES = 5


class CaseStartRequest(BaseModel):
    borrower_name:     str = Field(..., min_length=2, max_length=200)
    mobile:            str = Field(..., pattern=r"^\d{10}$")
    consent_text:      str = Field(..., min_length=10)
    consent_version:   Optional[str] = "v1.0"
    # Two product flows:
    #   - "business"   = limited company / LLP / partnership: full KYB branch
    #                    (BusinessPAN, CIN, GST search by business PAN) +
    #                    ITR/26AS run against the BUSINESS PAN.
    #   - "individual" = sole proprietor: KYB branch skipped, ITR/26AS run
    #                    against the PERSONAL PAN.
    borrower_type:     Literal["business", "individual"] = "business"
    entity_legal_name: str = Field(..., min_length=2, max_length=200)


class CaseStartResponse(BaseModel):
    case_id:     str   # human-readable, e.g. LOAN-20260425-3F9A2C
    case_uuid:   str   # internal UUID
    accepted_at: datetime


def _generate_case_id() -> str:
    """LOAN-YYYYMMDD-{6 uppercase hex chars}. ~16M combinations per day."""
    today  = datetime.utcnow().strftime("%Y%m%d")
    suffix = secrets.token_hex(3).upper()  # 6 hex chars
    return f"LOAN-{today}-{suffix}"


def _client_ip(req: Request) -> Optional[str]:
    fwd = req.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return req.client.host if req.client else None


@router.post("/start", response_model=CaseStartResponse)
async def start_case(req: CaseStartRequest,
                     http_req: Request,
                     db: AsyncSession = Depends(get_session)):
    # Generate a unique case_id with retry on (very unlikely) collision
    case = None
    for _ in range(MAX_GENERATION_RETRIES):
        candidate = _generate_case_id()
        existing = (await db.execute(
            select(Case).where(Case.case_id == candidate)
        )).scalar_one_or_none()
        if existing is None:
            case = Case(
                case_id=candidate,
                borrower_name=req.borrower_name,
                borrower_type=req.borrower_type,
                entity_legal_name=req.entity_legal_name.strip(),
            )
            db.add(case)
            await db.flush()
            break
    if case is None:
        raise HTTPException(status_code=500,
                            detail="Could not generate a unique case_id; please retry")

    consent = CaseConsent(
        case_id         = case.id,
        consent_text    = req.consent_text,
        consent_version = req.consent_version or "v1.0",
        borrower_name   = req.borrower_name,
        mobile          = req.mobile,
        ip_address      = _client_ip(http_req),
        user_agent      = http_req.headers.get("user-agent"),
    )
    db.add(consent)
    await db.flush()

    return CaseStartResponse(
        case_id     = case.case_id,
        case_uuid   = str(case.id),
        accepted_at = consent.accepted_at,
    )
