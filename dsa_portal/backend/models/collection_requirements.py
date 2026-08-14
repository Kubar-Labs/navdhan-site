"""Validated request/response contracts for Phase 4 (requirements, documents, facilities)."""

from __future__ import annotations

from datetime import date
from typing import Annotated, Literal

from pydantic import ConfigDict, Field, StringConstraints

from models.collection_application import CollectionRequest, VersionedCollectionRequest


LenderName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=150)]


class CreditDeclaration(VersionedCollectionRequest):
    has_active_credit_facilities: bool
    declared_cibil_score: Annotated[int, Field(ge=300, le=900)]


class CreditFacility(VersionedCollectionRequest):
    """The approved borrower-declared existing-facility field set.

    All ten approved fields (loan type, lender, ROI, EMI, loan amount,
    tenure, start date, end date, outstanding, paid-EMI count) are required
    — the borrower is declaring one complete existing facility, not a
    partial record.
    """

    facility_type: Literal[
        "home", "personal", "car", "education", "vehicle", "business", "gold", "credit", "other"
    ]
    lender_name: LenderName
    original_loan_amount: Annotated[int, Field(ge=0)]
    outstanding_amount: Annotated[int, Field(ge=0)]
    emi_amount: Annotated[int, Field(ge=0)]
    interest_rate_percent: Annotated[float, Field(ge=0, le=100)]
    tenure_months: Annotated[int, Field(gt=0)]
    start_date: date
    end_date: date
    emis_paid_count: Annotated[int, Field(ge=0)]
    total_amount_paid: Annotated[int, Field(ge=0)] | None = None
    is_closed: bool = False

    def model_post_init(self, __context: object) -> None:
        if self.end_date < self.start_date:
            raise ValueError("end_date must not be before start_date")


class DocumentUploadMetadata(CollectionRequest):
    model_config = ConfigDict(extra="forbid")

    application_requirement_id: str
    expected_lock_version: Annotated[int, Field(ge=0)]
    coverage_from: date | None = None
    coverage_to: date | None = None
    supersedes_document_id: str | None = None
