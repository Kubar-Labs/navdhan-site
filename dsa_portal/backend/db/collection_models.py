"""SQLAlchemy mappings for the collection-only application's core tables.

The PostgreSQL migrations own schema creation. These mappings intentionally
contain no ``create_all`` or migration side effects.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    Boolean,
    CHAR,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    LargeBinary,
    Numeric,
    SmallInteger,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import CITEXT, ENUM, INET, JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class CollectionBase(DeclarativeBase):
    """Declarative registry for the new collection schema only."""


ENTITY_CONSTITUTIONS = (
    "proprietorship",
    "partnership",
    "private_limited",
    "llp",
    "one_person_company",
    "public_limited",
    "huf",
    "trust",
    "society",
    "section_8_company",
    "individual",
)
PARTY_ROLES = (
    "applicant",
    "co_applicant",
    "proprietor",
    "partner",
    "director",
    "shareholder",
    "authorised_signatory",
    "guarantor",
    "trustee",
    "karta",
)
APPLICATION_STATUSES = (
    "in_progress",
    "kyc_pending",
    "consent_pending",
    "documents_pending",
    "under_review",
    "submitted",
    "offer_issued",
    "offer_accepted",
    "sanctioned",
    "agreement_pending",
    "disbursed",
    "rejected",
    "withdrawn",
    "expired",
    "abandoned",
)


class Marketplace(CollectionBase):
    __tablename__ = "marketplaces"

    marketplace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(CITEXT, nullable=False, unique=True)
    legal_name: Mapped[str] = mapped_column(Text, nullable=False)
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        ENUM(
            "onboarding",
            "active",
            "suspended",
            "offboarded",
            name="record_status",
            create_type=False,
        ),
        nullable=False,
        server_default="onboarding",
    )
    data_region: Mapped[str] = mapped_column(
        Text, nullable=False, server_default="asia-south1"
    )
    settings: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    contract_start_date: Mapped[date | None] = mapped_column(Date)
    contract_end_date: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class LoanProduct(CollectionBase):
    __tablename__ = "loan_products"

    product_code: Mapped[str] = mapped_column(CITEXT, primary_key=True)
    family: Mapped[str] = mapped_column(
        ENUM(
            "point_of_sale",
            "commercial",
            "trade_finance",
            name="product_family",
            create_type=False,
        ),
        nullable=False,
    )
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    is_secured: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    min_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    max_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    currency: Mapped[str] = mapped_column(CHAR(3), nullable=False, server_default="INR")
    min_tenure_months: Mapped[int | None] = mapped_column(SmallInteger)
    max_tenure_months: Mapped[int | None] = mapped_column(SmallInteger)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class ChecklistVersion(CollectionBase):
    __tablename__ = "checklist_versions"
    __table_args__ = (
        UniqueConstraint("marketplace_id", "checklist_version_id"),
        UniqueConstraint(
            "marketplace_id",
            "checklist_version_id",
            "product_code",
            "constitution",
        ),
    )

    checklist_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    version_no: Mapped[int] = mapped_column(Integer, nullable=False)
    product_code: Mapped[str] = mapped_column(
        CITEXT, ForeignKey("loan_products.product_code"), nullable=False
    )
    constitution: Mapped[str] = mapped_column(
        ENUM(*ENTITY_CONSTITUTIONS, name="entity_constitution", create_type=False),
        nullable=False,
    )
    lender_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    marketplace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("marketplaces.marketplace_id"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        ENUM("draft", "active", "retired", name="checklist_status", create_type=False),
        nullable=False,
        server_default="draft",
    )
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date | None] = mapped_column(Date)
    published_by: Mapped[str | None] = mapped_column(Text)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class DocumentType(CollectionBase):
    __tablename__ = "document_types"

    document_type_code: Mapped[str] = mapped_column(CITEXT, primary_key=True)
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(
        ENUM(
            "kyc", "entity_proof", "vintage", "financial", "banking", "tax", "obligation",
            "premises", "legal", name="document_category", create_type=False,
        ),
        nullable=False,
    )
    attaches_to: Mapped[str] = mapped_column(
        ENUM("entity", "person", "facility", "document", "registration", name="attaches_to", create_type=False),
        nullable=False,
    )
    is_periodic: Mapped[bool] = mapped_column(Boolean, nullable=False)
    periodicity: Mapped[str] = mapped_column(
        ENUM("none", "monthly", "quarterly", "annual", name="periodicity", create_type=False),
        nullable=False,
    )
    is_multi_instance: Mapped[bool] = mapped_column(Boolean, nullable=False)
    allows_consolidated_file: Mapped[bool] = mapped_column(Boolean, nullable=False)
    max_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    max_page_count: Mapped[int | None] = mapped_column(Integer)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))


class DocumentTypeMimeType(CollectionBase):
    __tablename__ = "document_type_mime_types"

    document_type_code: Mapped[str] = mapped_column(
        CITEXT, ForeignKey("document_types.document_type_code"), primary_key=True
    )
    mime_type: Mapped[str] = mapped_column(Text, primary_key=True)


class Borrower(CollectionBase):
    __tablename__ = "borrowers"
    __table_args__ = (
        UniqueConstraint("marketplace_id", "external_ref"),
        UniqueConstraint("marketplace_id", "borrower_id"),
    )

    borrower_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    marketplace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("marketplaces.marketplace_id"), nullable=False
    )
    external_ref: Mapped[str] = mapped_column(Text, nullable=False)
    constitution: Mapped[str] = mapped_column(
        ENUM(*ENTITY_CONSTITUTIONS, name="entity_constitution", create_type=False),
        nullable=False,
    )
    legal_name: Mapped[str | None] = mapped_column(Text)
    trade_name: Mapped[str | None] = mapped_column(Text)
    date_of_incorporation: Mapped[date | None] = mapped_column(Date)
    business_type_code: Mapped[str | None] = mapped_column(CITEXT)
    industry_nic_code: Mapped[str | None] = mapped_column(Text)
    annual_turnover: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    turnover_currency: Mapped[str] = mapped_column(
        CHAR(3), nullable=False, server_default="INR"
    )
    type_of_office: Mapped[str | None] = mapped_column(
        ENUM(
            "factory_premises",
            "home_office",
            "owned_office",
            "rented_office",
            "other",
            name="type_of_office",
            create_type=False,
        )
    )
    premises_ownership: Mapped[str | None] = mapped_column(
        ENUM(
            "owned",
            "rented",
            "leased",
            "family_owned",
            name="premises_ownership",
            create_type=False,
        )
    )
    location_tier: Mapped[str | None] = mapped_column(
        ENUM("tier1", "tier2", "tier3", name="location_tier", create_type=False)
    )
    registered_address: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    operating_address: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    attributes: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    status: Mapped[str] = mapped_column(
        ENUM("active", "blocked", "purged", name="borrower_status", create_type=False),
        nullable=False,
        server_default="active",
    )
    pii_purge_after: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    pii_purged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class BorrowerRegistration(CollectionBase):
    __tablename__ = "borrower_registrations"
    __table_args__ = (
        UniqueConstraint("marketplace_id", "registration_id"),
        UniqueConstraint(
            "marketplace_id", "borrower_id", "kind", "value_hash"
        ),
        ForeignKeyConstraint(
            ["marketplace_id", "borrower_id"],
            ["borrowers.marketplace_id", "borrowers.borrower_id"],
        ),
        Index(
            "borrower_registrations_primary_kind_uq",
            "marketplace_id",
            "borrower_id",
            "kind",
            unique=True,
            postgresql_where=text("is_primary"),
        ),
    )

    registration_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    marketplace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )
    borrower_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    kind: Mapped[str] = mapped_column(
        ENUM(
            "entity_pan",
            "gstin",
            "cin",
            "llpin",
            "udyam",
            "shop_establishment",
            "trade_license",
            "vat_tin",
            "iec",
            "fssai",
            "professional_tax",
            name="registration_kind",
            create_type=False,
        ),
        nullable=False,
    )
    value_enc: Mapped[bytes | None] = mapped_column(LargeBinary)
    value_hash: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    masked_value: Mapped[str] = mapped_column(Text, nullable=False)
    state_code: Mapped[str | None] = mapped_column(CHAR(2))
    issued_on: Mapped[date | None] = mapped_column(Date)
    valid_till: Mapped[date | None] = mapped_column(Date)
    is_primary: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    verification_state: Mapped[str] = mapped_column(
        ENUM(
            "not_attempted",
            "pending",
            "passed",
            "failed",
            name="verification_state",
            create_type=False,
        ),
        nullable=False,
        server_default="not_attempted",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Person(CollectionBase):
    __tablename__ = "persons"
    __table_args__ = (
        UniqueConstraint("marketplace_id", "person_id"),
        Index(
            "persons_email_hash_idx",
            "marketplace_id",
            "email_hash",
            postgresql_where=text("email_hash IS NOT NULL"),
        ),
    )

    person_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    marketplace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("marketplaces.marketplace_id"), nullable=False
    )
    full_name: Mapped[str | None] = mapped_column(Text)
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    gender: Mapped[str | None] = mapped_column(Text)
    mobile_enc: Mapped[bytes | None] = mapped_column(LargeBinary)
    mobile_hash: Mapped[bytes | None] = mapped_column(LargeBinary)
    email_enc: Mapped[bytes | None] = mapped_column(LargeBinary)
    email_hash: Mapped[bytes | None] = mapped_column(LargeBinary)
    address: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    type_of_residence: Mapped[str | None] = mapped_column(
        ENUM(
            "family_owned",
            "owned",
            "rented",
            "other",
            name="type_of_residence",
            create_type=False,
        )
    )
    employment_status_code: Mapped[str | None] = mapped_column(CITEXT)
    kyc_state: Mapped[str] = mapped_column(
        ENUM(
            "not_attempted",
            "pending",
            "passed",
            "failed",
            name="verification_state",
            create_type=False,
        ),
        nullable=False,
        server_default="not_attempted",
    )
    pii_purge_after: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    pii_purged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class PersonIdentifier(CollectionBase):
    __tablename__ = "person_identifiers"
    __table_args__ = (
        ForeignKeyConstraint(
            ["marketplace_id", "person_id"],
            ["persons.marketplace_id", "persons.person_id"],
        ),
        UniqueConstraint("marketplace_id", "person_id", "id_type"),
    )

    identifier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    marketplace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    person_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    id_type: Mapped[str] = mapped_column(
        ENUM(
            "pan",
            "aadhaar",
            "passport",
            "voter_id",
            "driving_licence",
            "din",
            "ckyc_id",
            name="identifier_kind",
            create_type=False,
        ),
        nullable=False,
    )
    value_enc: Mapped[bytes | None] = mapped_column(LargeBinary)
    value_hash: Mapped[bytes | None] = mapped_column(LargeBinary)
    masked_value: Mapped[str | None] = mapped_column(Text)
    issued_on: Mapped[date | None] = mapped_column(Date)
    valid_till: Mapped[date | None] = mapped_column(Date)
    source: Mapped[str] = mapped_column(
        ENUM(
            "manual_entry",
            "digilocker",
            "ckyc",
            "ocr_extracted",
            "partner_prefill",
            name="identifier_source",
            create_type=False,
        ),
        nullable=False,
    )
    source_document_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    verification_state: Mapped[str] = mapped_column(
        ENUM(
            "not_attempted",
            "pending",
            "passed",
            "failed",
            name="verification_state",
            create_type=False,
        ),
        nullable=False,
        server_default="not_attempted",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    purged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class BorrowerPerson(CollectionBase):
    __tablename__ = "borrower_persons"
    __table_args__ = (
        ForeignKeyConstraint(
            ["marketplace_id", "borrower_id"],
            ["borrowers.marketplace_id", "borrowers.borrower_id"],
        ),
        ForeignKeyConstraint(
            ["marketplace_id", "person_id"],
            ["persons.marketplace_id", "persons.person_id"],
        ),
    )

    borrower_person_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    marketplace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    borrower_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    person_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    role: Mapped[str] = mapped_column(
        ENUM(*PARTY_ROLES, name="party_role", create_type=False), nullable=False
    )
    ownership_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    is_authorised_signatory: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    is_beneficial_owner: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class LoanApplication(CollectionBase):
    __tablename__ = "loan_applications"
    __table_args__ = (
        ForeignKeyConstraint(
            ["marketplace_id", "borrower_id"],
            ["borrowers.marketplace_id", "borrowers.borrower_id"],
        ),
        ForeignKeyConstraint(
            ["marketplace_id", "checklist_version_id"],
            [
                "checklist_versions.marketplace_id",
                "checklist_versions.checklist_version_id",
            ],
        ),
        ForeignKeyConstraint(
            ["marketplace_id", "checklist_version_id", "product_code", "constitution"],
            [
                "checklist_versions.marketplace_id",
                "checklist_versions.checklist_version_id",
                "checklist_versions.product_code",
                "checklist_versions.constitution",
            ],
        ),
        UniqueConstraint("marketplace_id", "application_no"),
        UniqueConstraint("marketplace_id", "application_id"),
    )

    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    marketplace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    borrower_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    application_no: Mapped[str] = mapped_column(Text, nullable=False)
    product_code: Mapped[str] = mapped_column(
        CITEXT, ForeignKey("loan_products.product_code"), nullable=False
    )
    constitution: Mapped[str] = mapped_column(
        ENUM(*ENTITY_CONSTITUTIONS, name="entity_constitution", create_type=False),
        nullable=False,
    )
    vintage_months: Mapped[int | None] = mapped_column(Integer)
    lender_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    offering_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    checklist_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )
    status: Mapped[str] = mapped_column(
        ENUM(*APPLICATION_STATUSES, name="application_status", create_type=False),
        nullable=False,
        server_default="in_progress",
    )
    requested_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    approved_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    currency: Mapped[str] = mapped_column(CHAR(3), nullable=False, server_default="INR")
    requested_tenure_months: Mapped[int | None] = mapped_column(SmallInteger)
    income_type_code: Mapped[str | None] = mapped_column(CITEXT)
    purpose: Mapped[str | None] = mapped_column(Text)
    channel: Mapped[str] = mapped_column(
        ENUM(
            "sdk_web",
            "sdk_mobile",
            "whatsapp",
            "webapp",
            "api",
            "ops_console",
            name="application_channel",
            create_type=False,
        ),
        nullable=False,
    )
    sdk_version: Mapped[str | None] = mapped_column(Text)
    lock_version: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    abandoned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decision_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    disbursed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rejection_reason: Mapped[str | None] = mapped_column(Text)
    attributes: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class ApplicationSession(CollectionBase):
    __tablename__ = "application_sessions"
    __table_args__ = (
        ForeignKeyConstraint(
            ["marketplace_id", "application_id"],
            ["loan_applications.marketplace_id", "loan_applications.application_id"],
        ),
    )

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    marketplace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("marketplaces.marketplace_id"), nullable=False
    )
    application_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    token_hash: Mapped[bytes] = mapped_column(LargeBinary, nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    last_used_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class DocumentRequirement(CollectionBase):
    __tablename__ = "document_requirements"
    __table_args__ = (
        UniqueConstraint("marketplace_id", "requirement_id"),
        ForeignKeyConstraint(
            ["marketplace_id", "checklist_version_id"],
            ["checklist_versions.marketplace_id", "checklist_versions.checklist_version_id"],
        ),
    )

    requirement_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    marketplace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    checklist_version_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    document_type_code: Mapped[str] = mapped_column(CITEXT, nullable=False)
    attaches_to: Mapped[str] = mapped_column(
        ENUM(
            "entity", "person", "facility", "document", "registration",
            name="attaches_to", create_type=False,
        ),
        nullable=False,
    )
    party_role: Mapped[str | None] = mapped_column(
        ENUM(*PARTY_ROLES, name="party_role", create_type=False)
    )
    obligation: Mapped[str] = mapped_column(
        ENUM("mandatory", "optional", "conditional", name="obligation", create_type=False),
        nullable=False,
    )
    blocks_submission: Mapped[bool] = mapped_column(Boolean, nullable=False)
    alt_group: Mapped[str | None] = mapped_column(Text)
    condition: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    coverage_mode: Mapped[str] = mapped_column(
        ENUM("none", "month_range", "fiscal_year", "per_facility", name="coverage_mode", create_type=False),
        nullable=False,
    )
    lookback_months: Mapped[int | None] = mapped_column(Integer)
    fixed_period_start: Mapped[date | None] = mapped_column(Date)
    min_count: Mapped[int] = mapped_column(Integer, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)


class ApplicationParty(CollectionBase):
    __tablename__ = "application_parties"
    __table_args__ = (
        UniqueConstraint("marketplace_id", "application_party_id"),
        UniqueConstraint("marketplace_id", "application_id", "application_party_id"),
        ForeignKeyConstraint(
            ["marketplace_id", "application_id"],
            ["loan_applications.marketplace_id", "loan_applications.application_id"],
        ),
        ForeignKeyConstraint(
            ["marketplace_id", "person_id"],
            ["persons.marketplace_id", "persons.person_id"],
        ),
    )

    application_party_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    marketplace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    application_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    person_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    role: Mapped[str] = mapped_column(
        ENUM(*PARTY_ROLES, name="party_role", create_type=False), nullable=False
    )
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    ownership_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class ApplicationStatusEvent(CollectionBase):
    __tablename__ = "application_status_events"
    __table_args__ = (
        ForeignKeyConstraint(
            ["marketplace_id", "application_id"],
            ["loan_applications.marketplace_id", "loan_applications.application_id"],
        ),
    )

    event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    marketplace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    application_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    from_status: Mapped[str | None] = mapped_column(
        ENUM(*APPLICATION_STATUSES, name="application_status", create_type=False)
    )
    to_status: Mapped[str] = mapped_column(
        ENUM(*APPLICATION_STATUSES, name="application_status", create_type=False), nullable=False
    )
    reason_code: Mapped[str | None] = mapped_column(Text)
    reason_text: Mapped[str | None] = mapped_column(Text)
    actor_type: Mapped[str] = mapped_column(
        ENUM("borrower", "marketplace", "ops", "system", "lender", name="actor_type", create_type=False),
        nullable=False,
    )
    actor_ref: Mapped[str | None] = mapped_column(Text)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, nullable=False, default=dict)


class ApplicationRequirement(CollectionBase):
    __tablename__ = "application_requirements"
    __table_args__ = (
        UniqueConstraint("marketplace_id", "application_requirement_id"),
        UniqueConstraint("marketplace_id", "application_id", "application_requirement_id"),
        ForeignKeyConstraint(
            ["marketplace_id", "application_id"],
            ["loan_applications.marketplace_id", "loan_applications.application_id"],
        ),
        ForeignKeyConstraint(
            ["marketplace_id", "requirement_id"],
            ["document_requirements.marketplace_id", "document_requirements.requirement_id"],
        ),
        ForeignKeyConstraint(
            ["marketplace_id", "application_id", "application_party_id"],
            [
                "application_parties.marketplace_id",
                "application_parties.application_id",
                "application_parties.application_party_id",
            ],
        ),
    )

    application_requirement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    marketplace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    application_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    requirement_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    document_type_code: Mapped[str] = mapped_column(CITEXT, nullable=False)
    attaches_to: Mapped[str] = mapped_column(
        ENUM("entity", "person", "facility", "document", "registration", name="attaches_to", create_type=False),
        nullable=False,
    )
    application_party_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    facility_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    obligation: Mapped[str] = mapped_column(
        ENUM("mandatory", "optional", "conditional", name="obligation", create_type=False), nullable=False
    )
    blocks_submission: Mapped[bool] = mapped_column(Boolean, nullable=False)
    alt_group: Mapped[str | None] = mapped_column(Text)
    coverage_mode: Mapped[str] = mapped_column(
        ENUM(
            "none",
            "month_range",
            "fiscal_year",
            "per_facility",
            name="coverage_mode",
            create_type=False,
        ),
        nullable=False,
        default="none",
    )
    min_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    required_period_from: Mapped[date | None] = mapped_column(Date)
    required_period_to: Mapped[date | None] = mapped_column(Date)
    fiscal_year_start: Mapped[date | None] = mapped_column(Date)
    cached_coverage_state: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(
        ENUM("pending", "partial", "collected", "accepted_for_review", "rejected", "waived", "not_applicable", "missing", name="requirement_status", create_type=False),
        nullable=False,
        default="pending",
    )
    reviewed_by: Mapped[str | None] = mapped_column(Text)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    waived_by: Mapped[str | None] = mapped_column(Text)
    waiver_reason: Mapped[str | None] = mapped_column(Text)
    waived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class ApplicationRequirementEvent(CollectionBase):
    __tablename__ = "application_requirement_events"
    __table_args__ = (
        ForeignKeyConstraint(
            ["marketplace_id", "application_requirement_id"],
            [
                "application_requirements.marketplace_id",
                "application_requirements.application_requirement_id",
            ],
        ),
    )

    event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    marketplace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    application_requirement_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    event_type: Mapped[str] = mapped_column(
        ENUM(
            "status_change", "waived", "rejected", "recalculated",
            name="requirement_event_type", create_type=False,
        ),
        nullable=False,
    )
    from_status: Mapped[str | None] = mapped_column(
        ENUM(
            "pending", "partial", "collected", "accepted_for_review", "rejected", "waived",
            "not_applicable", "missing", name="requirement_status", create_type=False,
        )
    )
    to_status: Mapped[str | None] = mapped_column(
        ENUM(
            "pending", "partial", "collected", "accepted_for_review", "rejected", "waived",
            "not_applicable", "missing", name="requirement_status", create_type=False,
        )
    )
    reason: Mapped[str | None] = mapped_column(Text)
    actor_type: Mapped[str] = mapped_column(
        ENUM("borrower", "marketplace", "ops", "system", "lender", name="actor_type", create_type=False),
        nullable=False,
    )
    actor_ref: Mapped[str | None] = mapped_column(Text)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, nullable=False, default=dict)


class ApplicationCreditDeclaration(CollectionBase):
    __tablename__ = "application_credit_declarations"
    __table_args__ = (
        ForeignKeyConstraint(
            ["marketplace_id", "application_id"],
            ["loan_applications.marketplace_id", "loan_applications.application_id"],
        ),
        ForeignKeyConstraint(
            ["marketplace_id", "application_id", "application_party_id"],
            [
                "application_parties.marketplace_id",
                "application_parties.application_id",
                "application_parties.application_party_id",
            ],
        ),
    )

    declaration_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    marketplace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    application_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    application_party_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    declared_cibil_score: Mapped[int | None] = mapped_column(Integer)
    score_source: Mapped[str] = mapped_column(
        ENUM("self_declared", "bureau_fetched", name="score_source", create_type=False),
        nullable=False,
        default="self_declared",
    )
    has_active_credit_facilities: Mapped[bool] = mapped_column(Boolean, nullable=False)
    declared_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    superseded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class ApplicationExistingCreditFacility(CollectionBase):
    __tablename__ = "application_existing_credit_facilities"
    __table_args__ = (
        UniqueConstraint("marketplace_id", "facility_id"),
        UniqueConstraint("marketplace_id", "application_id", "facility_id"),
        ForeignKeyConstraint(
            ["marketplace_id", "application_id"],
            ["loan_applications.marketplace_id", "loan_applications.application_id"],
        ),
    )

    facility_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    marketplace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    application_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    facility_type: Mapped[str] = mapped_column(
        ENUM(
            "home", "personal", "car", "education", "vehicle", "business", "gold", "credit", "other",
            name="facility_type", create_type=False,
        ),
        nullable=False,
    )
    lender_name: Mapped[str] = mapped_column(Text, nullable=False)
    original_loan_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    outstanding_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    emi_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    interest_rate_percent: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    currency: Mapped[str] = mapped_column(CHAR(3), nullable=False, server_default="INR")
    tenure_months: Mapped[int | None] = mapped_column(SmallInteger)
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    emis_paid_count: Mapped[int | None] = mapped_column(Integer)
    total_amount_paid: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    is_closed: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    source: Mapped[str] = mapped_column(
        ENUM("declared", "bureau", "bank_statement", "gst", name="facility_source", create_type=False),
        nullable=False,
        server_default="declared",
    )
    declared_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class Document(CollectionBase):
    __tablename__ = "documents"
    __table_args__ = (
        UniqueConstraint("marketplace_id", "document_id"),
        UniqueConstraint("marketplace_id", "application_id", "document_id"),
        UniqueConstraint("marketplace_id", "idempotency_key"),
        ForeignKeyConstraint(
            ["marketplace_id", "application_id"],
            ["loan_applications.marketplace_id", "loan_applications.application_id"],
        ),
        ForeignKeyConstraint(
            ["marketplace_id", "application_id", "application_party_id"],
            [
                "application_parties.marketplace_id",
                "application_parties.application_id",
                "application_parties.application_party_id",
            ],
        ),
        ForeignKeyConstraint(
            ["marketplace_id", "application_id", "facility_id"],
            [
                "application_existing_credit_facilities.marketplace_id",
                "application_existing_credit_facilities.application_id",
                "application_existing_credit_facilities.facility_id",
            ],
        ),
        ForeignKeyConstraint(
            ["marketplace_id", "supersedes_document_id"],
            ["documents.marketplace_id", "documents.document_id"],
        ),
    )

    document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    marketplace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    application_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    document_type_code: Mapped[str] = mapped_column(
        CITEXT, ForeignKey("document_types.document_type_code"), nullable=False
    )
    attaches_to: Mapped[str] = mapped_column(
        ENUM("entity", "person", "facility", "document", "registration", name="attaches_to", create_type=False),
        nullable=False,
    )
    borrower_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    application_party_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    facility_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    gcs_bucket: Mapped[str] = mapped_column(Text, nullable=False)
    gcs_object: Mapped[str] = mapped_column(Text, nullable=False)
    gcs_generation: Mapped[int | None] = mapped_column(Integer)
    sha256: Mapped[bytes | None] = mapped_column(LargeBinary)
    mime_type: Mapped[str] = mapped_column(Text, nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    page_count: Mapped[int | None] = mapped_column(Integer)
    is_password_protected: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    coverage_from: Mapped[date | None] = mapped_column(Date)
    coverage_to: Mapped[date | None] = mapped_column(Date)
    fiscal_year_start: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(
        ENUM("uploading", "uploaded", "scan_failed", "superseded", "purged", name="document_status", create_type=False),
        nullable=False,
        server_default="uploading",
    )
    scan_result: Mapped[str] = mapped_column(
        ENUM("pending", "clean", "infected", "unreadable", name="scan_result", create_type=False),
        nullable=False,
        server_default="pending",
    )
    extraction_status: Mapped[str] = mapped_column(
        ENUM("not_attempted", "pending", "parsed", "failed", name="extraction_status", create_type=False),
        nullable=False,
        server_default="not_attempted",
    )
    extracted_data: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    supersedes_document_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    idempotency_key: Mapped[str] = mapped_column(Text, nullable=False)
    uploaded_by_type: Mapped[str] = mapped_column(
        ENUM("borrower", "marketplace", "ops", "system", "lender", name="actor_type", create_type=False),
        nullable=False,
    )
    uploaded_by_ref: Mapped[str | None] = mapped_column(Text)
    uploaded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    retention_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    purged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class DocumentRequirementSatisfaction(CollectionBase):
    __tablename__ = "document_requirement_satisfactions"
    __table_args__ = (
        ForeignKeyConstraint(
            ["marketplace_id", "application_id"],
            ["loan_applications.marketplace_id", "loan_applications.application_id"],
        ),
        ForeignKeyConstraint(
            ["marketplace_id", "application_id", "application_requirement_id"],
            [
                "application_requirements.marketplace_id",
                "application_requirements.application_id",
                "application_requirements.application_requirement_id",
            ],
        ),
        ForeignKeyConstraint(
            ["marketplace_id", "application_id", "document_id"],
            ["documents.marketplace_id", "documents.application_id", "documents.document_id"],
        ),
    )

    satisfaction_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    marketplace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    application_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    application_requirement_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    linked_by_type: Mapped[str] = mapped_column(
        ENUM("borrower", "marketplace", "ops", "system", "lender", name="actor_type", create_type=False),
        nullable=False,
    )
    linked_by_ref: Mapped[str | None] = mapped_column(Text)
    linked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    unlinked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    unlink_reason: Mapped[str | None] = mapped_column(Text)


class DocumentEvent(CollectionBase):
    __tablename__ = "document_events"
    __table_args__ = (
        ForeignKeyConstraint(
            ["marketplace_id", "document_id"],
            ["documents.marketplace_id", "documents.document_id"],
        ),
    )

    event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    marketplace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    event_type: Mapped[str] = mapped_column(
        ENUM(
            "uploaded", "scanned", "parsed", "linked", "unlinked", "superseded", "purged",
            name="document_event_type", create_type=False,
        ),
        nullable=False,
    )
    actor_type: Mapped[str] = mapped_column(
        ENUM("borrower", "marketplace", "ops", "system", "lender", name="actor_type", create_type=False),
        nullable=False,
    )
    actor_ref: Mapped[str | None] = mapped_column(Text)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, nullable=False, default=dict)


class ConsentPurpose(CollectionBase):
    __tablename__ = "consent_purposes"

    purpose_code: Mapped[str] = mapped_column(CITEXT, primary_key=True)
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    notice_text: Mapped[str] = mapped_column(Text, nullable=False)
    notice_version: Mapped[int] = mapped_column(Integer, nullable=False)
    is_mandatory: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    retention_months: Mapped[int] = mapped_column(Integer, nullable=False)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date | None] = mapped_column(Date)


class ConsentGrant(CollectionBase):
    __tablename__ = "consent_grants"
    __table_args__ = (
        ForeignKeyConstraint(
            ["marketplace_id", "application_id"],
            ["loan_applications.marketplace_id", "loan_applications.application_id"],
        ),
        ForeignKeyConstraint(
            ["marketplace_id", "person_id"],
            ["persons.marketplace_id", "persons.person_id"],
        ),
    )

    grant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    marketplace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    application_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    person_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    purpose_code: Mapped[str] = mapped_column(
        CITEXT, ForeignKey("consent_purposes.purpose_code"), nullable=False
    )
    destination_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    notice_version: Mapped[int] = mapped_column(Integer, nullable=False)
    action: Mapped[str] = mapped_column(
        ENUM("granted", "revoked", name="consent_action", create_type=False), nullable=False
    )
    artefact_hash: Mapped[bytes | None] = mapped_column(LargeBinary)
    ip_address: Mapped[str | None] = mapped_column(INET)
    user_agent: Mapped[str | None] = mapped_column(Text)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
