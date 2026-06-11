"""
ORM models — mirror infra/sql/001_init.sql exactly.
Do NOT create tables from Python; schema is owned by the SQL migration files.
"""

import uuid
from datetime import datetime
from sqlalchemy import (Column, String, Text, BigInteger, Boolean, CHAR, Date,
                        ForeignKey, DateTime, Enum, Numeric, UniqueConstraint)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.sql import func


# Enum value tuples — must match the CREATE TYPE ... AS ENUM in SQL.
DOC_TYPES = ("aadhaar_card", "pan_card", "bank_statement",
             "itr", "form_26as", "aadhaar_photo")
VERIFICATION_TYPES = ("aadhaar", "pan", "gstin", "bank_statement",
                      "itr", "form_26as")
CASE_STATUSES = ("pending", "in_progress", "verified", "rejected", "review")


class Base(DeclarativeBase):
    pass


class Borrower(Base):
    __tablename__ = "borrowers"
    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name          = Column(Text, nullable=False)
    pan           = Column(Text, unique=True)
    aadhaar_hash  = Column(Text, unique=True)
    dob           = Column(Date)
    mobile        = Column(Text)
    email         = Column(Text)
    created_at    = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class CaseConsent(Base):
    """
    Consent record captured ONCE at journey start. Covers all downstream
    verifications. Borrower's typed name acts as digital signature.
    """
    __tablename__ = "case_consents"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id         = Column(UUID(as_uuid=True),
                              ForeignKey("cases.id", ondelete="CASCADE"),
                              nullable=False)
    consent_text    = Column(Text, nullable=False)
    consent_version = Column(Text)
    borrower_name   = Column(Text, nullable=False)
    mobile          = Column(Text)
    ip_address      = Column(Text)
    user_agent      = Column(Text)
    accepted_at     = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at      = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Case(Base):
    """
    The verification journey. PII (pan, aadhaar_hash, borrower_name) lives
    directly on this row during the journey — case_id is the single identity.
    `borrower_id` is nullable; populated later by a post-journey de-dup.
    """
    __tablename__  = "cases"
    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id        = Column(Text, unique=True, nullable=False)
    borrower_id    = Column(UUID(as_uuid=True), ForeignKey("borrowers.id"))  # set by de-dup
    status         = Column(Enum(*CASE_STATUSES, name="case_status", create_type=False),
                             nullable=False, server_default="pending")
    loan_amount    = Column(BigInteger)
    loan_type      = Column(Text)
    # Borrower classification chosen at consent: 'individual' or 'business'.
    # Business borrowers (Pvt Ltd / LLP / firm) have no Aadhaar and use a
    # non-'P' 4th-char PAN; the journey skips Aadhaar for them.
    borrower_type      = Column(Text, nullable=False, server_default="individual")
    entity_legal_name  = Column(Text)
    # PII captured during the journey
    pan            = Column(Text)
    aadhaar_hash   = Column(Text)
    borrower_name  = Column(Text)
    created_at     = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at     = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (UniqueConstraint("case_id", "doc_type", name="documents_case_id_doc_type_key"),)

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id      = Column(UUID(as_uuid=True), ForeignKey("cases.id", ondelete="CASCADE"))
    doc_type     = Column(Enum(*DOC_TYPES, name="doc_type", create_type=False), nullable=False)
    gcs_bucket   = Column(Text, nullable=False)
    gcs_path     = Column(Text, nullable=False)
    content_type = Column(Text)
    size_bytes   = Column(BigInteger)
    sha256       = Column(CHAR(64))
    uploaded_at  = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AadhaarVerification(Base):
    """
    Per-type Aadhaar eKYC result. Photo inlined (no documents ref).
    aadhaar_hash = de-dup, aadhaar_ciphertext = reversible (AES-256-GCM).
    """
    __tablename__ = "aadhaar_verifications"

    id                   = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id              = Column(UUID(as_uuid=True),
                                   ForeignKey("cases.id", ondelete="CASCADE"),
                                   nullable=False, unique=True)

    aadhaar_hash         = Column(Text, nullable=False)
    aadhaar_ciphertext   = Column(Text, nullable=False)
    aadhaar_last_4       = Column(CHAR(4))
    borrower_name        = Column(Text)             # nullable — name now comes from PAN

    mobile_input         = Column(Text)             # mobile entered by user
    valid_id             = Column(Text)             # "Yes"/"No" from v3/aadhaar-mobilelink
    is_mobile_linked     = Column(Text)             # "Yes"/"No"
    is_verified_mobile   = Column(Text)             # "Yes"/"No"

    # Legacy columns retained for existing rows
    is_issued            = Column(Text)
    gender               = Column(Text)
    state                = Column(Text)
    age_band             = Column(Text)
    mobile               = Column(Text)

    status               = Column(Text, nullable=False)
    perfios_status_code  = Column(Text)
    perfios_request_id   = Column(Text)
    error_code           = Column(Text)
    error_reason         = Column(Text)

    raw_response         = Column(JSONB)

    created_at           = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at           = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class PanVerification(Base):
    """
    Per-type PAN verification. PAN is encrypted + hashed + last4.
    /pan/link updates this same row (pan_aadhaar_linked, checked_at, response).
    """
    __tablename__ = "pan_verifications"

    id                           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id                      = Column(UUID(as_uuid=True),
                                           ForeignKey("cases.id", ondelete="CASCADE"),
                                           nullable=False, unique=True)

    pan_hash                     = Column(Text, nullable=False)
    pan_ciphertext               = Column(Text, nullable=False)
    pan_last_4                   = Column(CHAR(4))
    borrower_name_input          = Column(Text)
    borrower_name                = Column(Text)

    status                       = Column(Text, nullable=False)
    perfios_status_code          = Column(Text)
    perfios_request_id           = Column(Text)
    error_code                   = Column(Text)
    error_reason                 = Column(Text)

    pan_aadhaar_linked           = Column(Boolean)
    pan_aadhaar_link_checked_at  = Column(DateTime(timezone=True))
    pan_aadhaar_link_response    = Column(JSONB)

    raw_response                 = Column(JSONB)

    created_at                   = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at                   = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class GstVerification(Base):
    """
    Per-type GST verification. One row per case_id; both Perfios calls
    (/verify, /returns) upsert into this row.
    """
    __tablename__ = "gst_verifications"

    id                            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id                       = Column(UUID(as_uuid=True),
                                            ForeignKey("cases.id", ondelete="CASCADE"),
                                            nullable=False, unique=True)

    gstin_hash                    = Column(Text, nullable=False)
    gstin_ciphertext              = Column(Text, nullable=False)
    gstin_last_4                  = Column(CHAR(4))

    legal_name                    = Column(Text)
    trade_name                    = Column(Text)
    gst_status                    = Column(Text)
    constitution                  = Column(Text)
    taxpayer_type                 = Column(Text)
    registration_date             = Column(Text)
    cancellation_date             = Column(Text)
    cancel_flag                   = Column(Text)

    primary_address               = Column(Text)
    additional_addresses          = Column(JSONB)
    state_jurisdiction            = Column(Text)
    center_jurisdiction           = Column(Text)
    state_jurisdiction_code       = Column(Text)
    center_jurisdiction_code      = Column(Text)

    contact_name                  = Column(Text)
    contact_email_ciphertext      = Column(Text)
    contact_mobile_ciphertext     = Column(Text)
    contact_mobile_last_4         = Column(CHAR(4))

    members                       = Column(JSONB)
    business_activities           = Column(JSONB)
    goods_business_details        = Column(JSONB)
    services_business_details     = Column(JSONB)
    core_business                 = Column(Text)

    turnover_slab                 = Column(Text)
    turnover_slab_fy              = Column(Text)
    gross_income                  = Column(Text)
    gross_income_fy               = Column(Text)
    composition_rate              = Column(Text)
    percent_tax_in_cash           = Column(Text)
    percent_tax_in_cash_fy        = Column(Text)

    aadhaar_verified              = Column(Text)
    ekyc_verified                 = Column(Text)
    einvoice_mandated             = Column(Text)
    einvoice_status               = Column(Text)
    compliance_detail_available   = Column(Boolean)

    is_defaulter                  = Column(Boolean)
    is_any_delay                  = Column(Boolean)
    gstr1_count                   = Column(BigInteger)
    gstr3b_count                  = Column(BigInteger)
    gstr1a_count                  = Column(BigInteger)
    delayed_filings_count         = Column(BigInteger)
    filings                       = Column(JSONB)
    filing_frequency              = Column(JSONB)

    status                        = Column(Text, nullable=False)
    perfios_status_code           = Column(Text)
    verify_perfios_request_id     = Column(Text)
    returns_perfios_request_id    = Column(Text)
    error_code                    = Column(Text)
    error_reason                  = Column(Text)

    raw_verify_response           = Column(JSONB)
    raw_returns_response          = Column(JSONB)

    created_at                    = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at                    = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ItrVerification(Base):
    """
    Per-type ITR (Business API) verification.
    PAN encrypted+hashed; IT-portal password NEVER stored.
    Latest-year financials denormalized for fast queries.
    """
    __tablename__ = "itr_verifications"

    id                              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id                         = Column(UUID(as_uuid=True),
                                              ForeignKey("cases.id", ondelete="CASCADE"),
                                              nullable=False, unique=True)

    pan_hash                        = Column(Text, nullable=False)
    pan_ciphertext                  = Column(Text, nullable=False)
    pan_last_4                      = Column(CHAR(4))
    portal_password_ciphertext      = Column(Text)   # AES-256-GCM; decrypted by lender at analysis time
    api_version                     = Column(Text)
    number_of_years_requested       = Column(BigInteger)
    additional_data_requested       = Column(Boolean)
    partial_report_requested        = Column(Boolean)

    entity_name                     = Column(Text)
    entity_pan                      = Column(Text)
    entity_type                     = Column(Text)
    date_of_birth_or_incorporation  = Column(Text)
    entity_address                  = Column(Text)

    # Perfios's 14-day expiring links
    pdf_download_link               = Column(Text)
    excel_report_link               = Column(Text)
    # Permanent GCS archive of those files
    pdf_gcs_bucket                  = Column(Text)
    pdf_gcs_path                    = Column(Text)
    excel_gcs_bucket                = Column(Text)
    excel_gcs_path                  = Column(Text)

    # Alternative to credentials: user-uploaded sheet (one file per case).
    # input_method records which path was taken: 'credentials' | 'upload' | 'skipped'.
    input_method                    = Column(Text)
    upload_gcs_bucket               = Column(Text)
    upload_gcs_path                 = Column(Text)
    upload_gcs_url                  = Column(Text)
    upload_content_type             = Column(Text)
    upload_size_bytes               = Column(BigInteger)
    upload_sha256                   = Column(CHAR(64))
    upload_original_filename        = Column(Text)

    status                          = Column(Text, nullable=False)
    perfios_status_code             = Column(Text)
    perfios_request_id              = Column(Text)
    error_code                      = Column(Text)
    error_reason                    = Column(Text)

    raw_response                    = Column(JSONB)

    created_at                      = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at                      = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Form26asVerification(Base):
    """
    Per-type Form 26AS verification. PAN encrypted+hashed.
    Per-AY data in JSONB; aggregate signals denormalized for SQL queries.
    """
    __tablename__ = "form26as_verifications"

    id                          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id                     = Column(UUID(as_uuid=True),
                                          ForeignKey("cases.id", ondelete="CASCADE"),
                                          nullable=False, unique=True)

    pan_hash                    = Column(Text, nullable=False)
    pan_ciphertext              = Column(Text, nullable=False)
    pan_last_4                  = Column(CHAR(4))
    source                      = Column(Text)
    api_version                 = Column(Text)
    assessment_years_requested  = Column(ARRAY(Text))

    borrower_name               = Column(Text)
    borrower_pan                = Column(Text)
    borrower_status             = Column(Text)
    borrower_address            = Column(Text)

    status_of_26as_data         = Column(Text)

    # Perfios's 14-day expiring links + their internal paths
    pdf_download_link           = Column(Text)
    pdf_bucket_path             = Column(Text)
    excel_download_link         = Column(Text)
    excel_bucket_path           = Column(Text)
    # Permanent GCS archive of those files
    pdf_gcs_bucket              = Column(Text)
    pdf_gcs_path                = Column(Text)
    excel_gcs_bucket            = Column(Text)
    excel_gcs_path              = Column(Text)

    # Alternative to credentials: user-uploaded sheet (one file per case).
    input_method                = Column(Text)   # 'credentials' | 'upload' | 'skipped'
    upload_gcs_bucket           = Column(Text)
    upload_gcs_path             = Column(Text)
    upload_gcs_url              = Column(Text)
    upload_content_type         = Column(Text)
    upload_size_bytes           = Column(BigInteger)
    upload_sha256               = Column(CHAR(64))
    upload_original_filename    = Column(Text)

    status                      = Column(Text, nullable=False)
    perfios_status_code         = Column(Text)
    perfios_request_id          = Column(Text)
    error_code                  = Column(Text)
    error_reason                = Column(Text)

    raw_response                = Column(JSONB)

    created_at                  = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at                  = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class BsaVerification(Base):
    """
    Lean bank-statement collection (DSA mode). PDF + password stored in our
    GCS + DB; Perfios analysis is deferred to the lender.
    Password is AES-256-GCM encrypted and only decrypted at analysis time.
    """
    __tablename__ = "bsa_verifications"

    id                       = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id                  = Column(UUID(as_uuid=True),
                                       ForeignKey("cases.id", ondelete="CASCADE"),
                                       nullable=False, unique=True)

    loan_amount              = Column(BigInteger)
    loan_duration_months     = Column(BigInteger)
    loan_type                = Column(Text)

    pdf_gcs_bucket           = Column(Text, nullable=False)
    pdf_gcs_path             = Column(Text, nullable=False)
    pdf_content_type         = Column(Text)
    pdf_size_bytes           = Column(BigInteger)
    pdf_sha256               = Column(CHAR(64))
    pdf_original_filename    = Column(Text)

    pdf_password_ciphertext        = Column(Text)   # null when PDF not protected

    # Perfios tamper-detection signals
    statement_status               = Column(Text)    # VERIFIED = authentic e-statement
    is_suspicious_e_statement      = Column(Boolean) # true = tampered / suspicious

    # Perfios report files (permanent GCS copies)
    xlsx_gcs_bucket                = Column(Text)
    xlsx_gcs_path                  = Column(Text)
    json_report_gcs_bucket         = Column(Text)
    json_report_gcs_path           = Column(Text)

    status                         = Column(Text, nullable=False, server_default="UPLOADED")
    error_code                     = Column(Text)
    error_reason                   = Column(Text)

    perfios_transaction_id         = Column(Text)
    perfios_request_id             = Column(Text)
    raw_response                   = Column(JSONB)

    created_at                     = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at                     = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class PlVerification(Base):
    """
    Profit & Loss document collection. Collect-only — no analysis at upload time.
    """
    __tablename__ = "pl_verifications"

    id                    = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id               = Column(UUID(as_uuid=True),
                                    ForeignKey("cases.id", ondelete="CASCADE"),
                                    nullable=False, unique=True)

    doc_gcs_bucket        = Column(Text, nullable=False)
    doc_gcs_path          = Column(Text, nullable=False)
    doc_gcs_url           = Column(Text, nullable=False)   # gs://bucket/path
    doc_content_type      = Column(Text)
    doc_size_bytes        = Column(BigInteger)
    doc_sha256            = Column(CHAR(64))
    doc_original_filename = Column(Text)

    status                = Column(Text, nullable=False, server_default="UPLOADED")

    created_at            = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at            = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class KybPanVerification(Base):
    """Business PAN authentication. One row per case_id."""
    __tablename__ = "kyb_pan_verifications"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id             = Column(UUID(as_uuid=True),
                                  ForeignKey("cases.id", ondelete="CASCADE"),
                                  nullable=False, unique=True)
    pan_hash            = Column(Text, nullable=False)
    pan_ciphertext      = Column(Text, nullable=False)
    pan_last_4          = Column(CHAR(4))

    entity_name         = Column(Text)
    status              = Column(Text, nullable=False)
    perfios_request_id  = Column(Text)
    perfios_status_code = Column(Text)
    error_code          = Column(Text)
    error_reason        = Column(Text)
    raw_response        = Column(JSONB)

    created_at          = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at          = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class KybCinVerification(Base):
    """PAN → CIN/LLPIN lookup (Perfios KSCAN /v3/pan-cin)."""
    __tablename__ = "kyb_cin_verifications"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id             = Column(UUID(as_uuid=True),
                                  ForeignKey("cases.id", ondelete="CASCADE"),
                                  nullable=False, unique=True)
    pan_hash            = Column(Text, nullable=False)
    pan_ciphertext      = Column(Text, nullable=False)
    pan_last_4          = Column(CHAR(4))

    cin_llpin           = Column(Text)
    entity_name         = Column(Text)
    status              = Column(Text, nullable=False)
    perfios_request_id  = Column(Text)
    perfios_status_code = Column(Text)
    error_code          = Column(Text)
    error_reason        = Column(Text)
    raw_response        = Column(JSONB)

    created_at          = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at          = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class KybGstSearch(Base):
    """GST search by PAN (Perfios /gst/v2/search). Returns all GSTINs for a PAN."""
    __tablename__ = "kyb_gst_searches"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id             = Column(UUID(as_uuid=True),
                                  ForeignKey("cases.id", ondelete="CASCADE"),
                                  nullable=False, unique=True)
    pan_hash            = Column(Text, nullable=False)
    pan_ciphertext      = Column(Text, nullable=False)
    pan_last_4          = Column(CHAR(4))

    gstins              = Column(JSONB)
    gstin_ids           = Column(ARRAY(Text))
    gstin_count         = Column(BigInteger)
    status              = Column(Text, nullable=False)
    perfios_request_id  = Column(Text)
    perfios_status_code = Column(Text)
    error_code          = Column(Text)
    error_reason        = Column(Text)
    raw_response        = Column(JSONB)

    created_at          = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at          = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Verification(Base):
    __tablename__ = "verifications"
    __table_args__ = (UniqueConstraint("case_id", "type", name="verifications_case_id_type_key"),)

    id                 = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id            = Column(UUID(as_uuid=True), ForeignKey("cases.id", ondelete="CASCADE"))
    type               = Column(Enum(*VERIFICATION_TYPES, name="verification_type", create_type=False), nullable=False)
    perfios_txn_id     = Column(Text)
    status             = Column(Text)      # PROCESSING / COMPLETED / FAILED
    result_json        = Column(JSONB)
    error_code         = Column(Text)
    error_reason       = Column(Text)
    # Only set on `pan` verification rows, after the PAN-Aadhaar link check runs
    pan_aadhaar_linked = Column(Boolean)
    created_at         = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at         = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
