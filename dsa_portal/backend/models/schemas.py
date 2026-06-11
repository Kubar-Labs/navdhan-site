from pydantic import BaseModel, Field
from typing import Optional, List, Any


# ── Shared ────────────────────────────────────────────────────────────────────

class BaseResponse(BaseModel):
    status_code: Optional[int] = None
    request_id:  Optional[str] = None
    message:     Optional[str] = None
    raw:         Optional[Any] = None


class PersistenceInfo(BaseModel):
    """IDs of the rows written to Postgres for this request."""
    case_uuid:       Optional[str] = None  # cases.id (internal UUID)
    borrower_id:     Optional[str] = None  # borrowers.id
    document_id:     Optional[str] = None  # documents.id (present only if a file was uploaded)
    verification_id: Optional[str] = None  # verifications.id
    verified:        Optional[bool] = None  # true if Perfios confirmed, false if failed/rejected


# ── Aadhaar ───────────────────────────────────────────────────────────────────

class AadhaarVerifyRequest(BaseModel):
    aadhaar_no:   str = Field(..., min_length=12, max_length=12)
    name:         str = Field(..., min_length=3)
    case_id:      str
    consent_text: str

class AadhaarVerifyResponse(BaseResponse):
    valid_id:         Optional[str] = None   # "Yes" / "No"
    is_mobile_linked: Optional[str] = None   # "Yes" / "No"
    is_verified:      Optional[str] = None   # "Yes" / "No"
    persistence:      Optional[PersistenceInfo] = None


# ── PAN ───────────────────────────────────────────────────────────────────────

class PANVerifyRequest(BaseModel):
    pan:     str = Field(..., min_length=10, max_length=10)
    case_id: str

class PANVerifyResponse(BaseResponse):
    name:        Optional[str] = None
    persistence: Optional[PersistenceInfo] = None

class PANLinkRequest(BaseModel):
    pan:          str = Field(..., min_length=10, max_length=10)
    aadhaar_no:   str = Field(..., min_length=12, max_length=12)
    name:         str = Field(..., min_length=3)
    case_id:      str
    consent_text: str

class PANLinkResponse(BaseResponse):
    linked:      Optional[bool] = None
    persistence: Optional[PersistenceInfo] = None


# ── GST ───────────────────────────────────────────────────────────────────────

class GSTVerifyRequest(BaseModel):
    gstin:   str = Field(..., min_length=15, max_length=15)
    case_id: str

class GSTVerifyResponse(BaseResponse):
    legal_name:      Optional[str] = None
    trade_name:      Optional[str] = None
    status:          Optional[str] = None
    constitution:    Optional[str] = None
    registration_dt: Optional[str] = None
    turnover_slab:   Optional[str] = None
    core_business:   Optional[str] = None
    gross_income:    Optional[str] = None
    persistence:     Optional[PersistenceInfo] = None

class GSTReturnsRequest(BaseModel):
    gstin:             str = Field(..., min_length=15, max_length=15)
    case_id:           str
    due_info:          bool
    liability_details: bool
    latest_fy:         bool

class GSTReturnsResponse(BaseResponse):
    is_defaulter: Optional[bool]       = None
    is_any_delay: Optional[bool]       = None
    gstr1_count:  Optional[int]        = None
    gstr3b_count: Optional[int]        = None
    filings:      Optional[List[dict]] = None
    persistence:  Optional[PersistenceInfo] = None


# ── ITR ───────────────────────────────────────────────────────────────────────

class ITRFetchRequest(BaseModel):
    pan:             str = Field(..., min_length=10, max_length=10)
    password:        str
    case_id:         str
    number_of_years: int = Field(..., ge=1, le=3)
    additional_data: bool
    partial_report:  bool
    api_version:     str = Field(..., pattern="^1\\.0\\.[012]$")

class ITRFetchResponse(BaseResponse):
    entity_name: Optional[str]        = None
    entity_pan:  Optional[str]        = None
    entity_type: Optional[str]        = None
    itr_filed:   Optional[List[dict]] = None
    pdf_link:    Optional[str]        = None
    excel_link:  Optional[str]        = None
    persistence: Optional[PersistenceInfo] = None


# ── Form 26AS ─────────────────────────────────────────────────────────────────

class Form26ASRequest(BaseModel):
    pan:         str = Field(..., min_length=10, max_length=10)
    password:    str
    case_id:     str
    years:       List[str]
    source:      str = Field(..., pattern="^(TRACES|ITR)$")
    api_version: str = Field(..., pattern="^1\\.0\\.[012]$")

class Form26ASResponse(BaseResponse):
    pdf_link:    Optional[str] = None
    excel_link:  Optional[str] = None
    persistence: Optional[PersistenceInfo] = None


# ── Bank Statement Analysis ───────────────────────────────────────────────────

class BSAInitiateRequest(BaseModel):
    loan_amount:     int = Field(..., ge=1)
    loan_duration:   int = Field(..., ge=1, le=1188)
    loan_type:       str
    case_id:         str
    year_month_from: str = Field(..., pattern="^\\d{4}-\\d{2}$")
    year_month_to:   str = Field(..., pattern="^\\d{4}-\\d{2}$")

class BSAInitiateResponse(BaseModel):
    perfios_transaction_id: str

class BSAProcessRequest(BaseModel):
    file_id:        str
    institution_id: Optional[int] = None
    password:       Optional[str] = None

class BSAProcessResponse(BaseModel):
    accounts: List[dict] = []

class BSAStatusResponse(BaseModel):
    status:           str
    report_available: bool         = False
    error_code:       Optional[str] = None
    reason:           Optional[str] = None
