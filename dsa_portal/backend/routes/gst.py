"""
GST verification — case-centric. Two Perfios calls write to the SAME
gst_verifications row (UNIQUE on case_id):

  POST /gst/verify   →  /v2/gstdetailed-additional  (business profile)
  POST /gst/returns  →  /v2/gst-return-status       (filings)

Each call upserts only the fields it owns; the other call's fields are
preserved on conflict.
"""

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.sql import func

from models.schemas import (GSTVerifyRequest, GSTVerifyResponse,
                             GSTReturnsRequest, GSTReturnsResponse,
                             PersistenceInfo)
from services.perfios import get_client, post
from services.verification import get_or_create_case
from security.crypto import encrypt, sha256_hex, last_n
from db.session import get_session
from db.models import GstVerification
from config import BASE_GST

router = APIRouter(prefix="/gst", tags=["GST"])


def _gstin_keys(gstin: str) -> dict:
    return {
        "gstin_hash":       sha256_hex(gstin),
        "gstin_ciphertext": encrypt(gstin),
        "gstin_last_4":     last_n(gstin, 4),
    }


@router.post("/verify", response_model=GSTVerifyResponse)
async def verify_gst(req: GSTVerifyRequest,
                     client: httpx.AsyncClient = Depends(get_client),
                     db: AsyncSession = Depends(get_session)):
    case    = await get_or_create_case(db, case_id=req.case_id)
    payload = {"consent": "Y", "gstin": req.gstin}
    result  = await post(client, f"{BASE_GST}/v2/gstdetailed-additional",
                          payload, req.case_id)
    r       = result.get("result") or {}
    code    = result.get("statusCode") or result.get("status-code")
    gst_sts = (r.get("sts") or "").strip()
    verified = bool(r.get("lgnm")) and gst_sts.lower() == "active"

    contact = r.get("contacted") or {}
    contact_email  = contact.get("email")
    contact_mobile = str(contact.get("mobNum") or "") or None

    pradr = r.get("pradr") or {}

    values = {
        "case_id":                     case.id,
        **_gstin_keys(req.gstin),
        "legal_name":                  r.get("lgnm"),
        "trade_name":                  r.get("tradeNam"),
        "gst_status":                  r.get("sts"),
        "constitution":                r.get("ctb"),
        "taxpayer_type":               r.get("dty"),
        "registration_date":           r.get("rgdt"),
        "cancellation_date":           r.get("cxdt"),
        "cancel_flag":                 r.get("canFlag"),
        "primary_address":             pradr.get("adr"),
        "additional_addresses":        r.get("adadr"),
        "state_jurisdiction":          r.get("stj"),
        "center_jurisdiction":         r.get("ctj"),
        "state_jurisdiction_code":     r.get("stjCd"),
        "center_jurisdiction_code":    r.get("ctjCd"),
        "contact_name":                contact.get("name"),
        "contact_email_ciphertext":    encrypt(contact_email)  if contact_email  else None,
        "contact_mobile_ciphertext":   encrypt(contact_mobile) if contact_mobile else None,
        "contact_mobile_last_4":       last_n(contact_mobile, 4) if contact_mobile else None,
        "members":                     r.get("mbr"),
        "business_activities":         r.get("nba"),
        "goods_business_details":      r.get("bzgddtls"),
        "services_business_details":   r.get("bzsdtls"),
        "core_business":               r.get("ntcrbs"),
        "turnover_slab":               r.get("aggreTurnOver"),
        "turnover_slab_fy":            r.get("aggreTurnOverFY"),
        "gross_income":                r.get("gti"),
        "gross_income_fy":             r.get("gtiFY"),
        "composition_rate":            r.get("cmpRt"),
        "percent_tax_in_cash":         r.get("percentTaxInCash"),
        "percent_tax_in_cash_fy":      r.get("percentTaxInCashFY"),
        "aadhaar_verified":            r.get("adhrVFlag"),
        "ekyc_verified":               r.get("ekycVFlag"),
        "einvoice_mandated":           r.get("mandatedeInvoice"),
        "einvoice_status":             r.get("einvoiceStatus"),
        "compliance_detail_available": r.get("compDetl"),
        "status":                      "COMPLETED" if verified else "FAILED",
        "perfios_status_code":         str(code) if code is not None else None,
        "verify_perfios_request_id":   result.get("requestId"),
        "error_code":                  None if verified else str(code),
        "error_reason":                None if verified else (result.get("message") or "Verification failed"),
        "raw_verify_response":         result,
    }

    update_set = {k: v for k, v in values.items() if k != "case_id"}
    update_set["updated_at"] = func.now()
    stmt = pg_insert(GstVerification).values(**values).on_conflict_do_update(
        index_elements=["case_id"], set_=update_set,
    ).returning(GstVerification)
    row = (await db.execute(stmt)).scalar_one()

    if not verified:
        if not r.get("lgnm"):
            detail = "GSTIN not found. Please check your GST Identification Number and try again."
        else:
            detail = f"GSTIN status is '{gst_sts}' — only Active GSTINs are accepted."
        raise HTTPException(status_code=422, detail=detail)

    return GSTVerifyResponse(
        status_code     = code,
        request_id      = result.get("requestId"),
        legal_name      = r.get("lgnm"),
        trade_name      = r.get("tradeNam"),
        status          = r.get("sts"),
        constitution    = r.get("ctb"),
        registration_dt = r.get("rgdt"),
        turnover_slab   = r.get("aggreTurnOver"),
        core_business   = r.get("ntcrbs"),
        gross_income    = r.get("gti"),
        raw             = result,
        persistence     = PersistenceInfo(case_uuid=str(case.id),
                                           verification_id=str(row.id),
                                           verified=verified),
    )


@router.post("/returns", response_model=GSTReturnsResponse)
async def gst_return_history(req: GSTReturnsRequest,
                              client: httpx.AsyncClient = Depends(get_client),
                              db: AsyncSession = Depends(get_session)):
    case = await get_or_create_case(db, case_id=req.case_id)
    payload = {
        "consent":          "Y",
        "gstin":            req.gstin,
        "dueInfo":          req.due_info,
        "liabilityDetails": req.liability_details,
        "latestFy":         req.latest_fy,
    }
    result = await post(client, f"{BASE_GST}/v2/gst-return-status",
                         payload, req.case_id)
    r      = result.get("result") or {}
    code   = result.get("statusCode") or result.get("status-code")

    compliance = r.get("complianceStatus") or r.get("compliance_status") or {}

    # FIX: Perfios actually nests filings per-FY under r["result"][0..N]["eFiledlist"].
    # Flatten across all FYs. Old code read r["eFiledlist"] which is always empty.
    fy_blocks = r.get("result") or []
    if isinstance(fy_blocks, dict):
        fy_blocks = [fy_blocks]
    all_filings = []
    all_freq    = []
    for blk in fy_blocks:
        fl = blk.get("eFiledlist") or blk.get("EFiledlist") or []
        all_filings.extend(fl)
        ff = blk.get("filingFrequency") or []
        all_freq.extend(ff)
    # Fallback: top-level eFiledlist (older shape)
    if not all_filings:
        all_filings = r.get("eFiledlist") or r.get("EFiledlist") or []

    gstr1_count   = sum(1 for f in all_filings if f.get("rtntype") == "GSTR1")
    gstr3b_count  = sum(1 for f in all_filings if f.get("rtntype") == "GSTR3B")
    gstr1a_count  = sum(1 for f in all_filings if f.get("rtntype") == "GSTR1A")
    delayed_count = sum(1 for f in all_filings if f.get("isDelay"))

    values = {
        "case_id":                    case.id,
        **_gstin_keys(req.gstin),
        "is_defaulter":               compliance.get("isDefaulter") or compliance.get("is_defaulter"),
        "is_any_delay":               compliance.get("isAnyDelay")  or compliance.get("is_any_delay"),
        "gstr1_count":                gstr1_count,
        "gstr3b_count":               gstr3b_count,
        "gstr1a_count":               gstr1a_count,
        "delayed_filings_count":      delayed_count,
        "filings":                    all_filings,
        "filing_frequency":           all_freq,
        "returns_perfios_request_id": result.get("requestId"),
        "raw_returns_response":       result,
        # status only set if no row existed yet (e.g. /returns called before /verify)
        "status":                     "COMPLETED",
    }

    # Don't overwrite status / business profile / verify response on conflict —
    # only patch the filing-specific fields.
    update_set = {
        "is_defaulter":               values["is_defaulter"],
        "is_any_delay":               values["is_any_delay"],
        "gstr1_count":                gstr1_count,
        "gstr3b_count":               gstr3b_count,
        "gstr1a_count":               gstr1a_count,
        "delayed_filings_count":      delayed_count,
        "filings":                    all_filings,
        "filing_frequency":           all_freq,
        "returns_perfios_request_id": result.get("requestId"),
        "raw_returns_response":       result,
        "updated_at":                 func.now(),
    }
    stmt = pg_insert(GstVerification).values(**values).on_conflict_do_update(
        index_elements=["case_id"], set_=update_set,
    ).returning(GstVerification)
    row = (await db.execute(stmt)).scalar_one()

    return GSTReturnsResponse(
        status_code  = code,
        request_id   = result.get("requestId"),
        is_defaulter = compliance.get("isDefaulter") or compliance.get("is_defaulter"),
        is_any_delay = compliance.get("isAnyDelay")  or compliance.get("is_any_delay"),
        gstr1_count  = gstr1_count,
        gstr3b_count = gstr3b_count,
        filings      = all_filings,
        raw          = result,
        persistence  = PersistenceInfo(case_uuid=str(case.id),
                                        verification_id=str(row.id),
                                        verified=bool(all_filings)),
    )
