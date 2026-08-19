"""Masked application snapshots for the collection-only API."""

from __future__ import annotations

import base64
import uuid
from typing import Any

from sqlalchemy import select

from db.collection_models import (
    ApplicationCreditDeclaration,
    ApplicationExistingCreditFacility,
    ApplicationParty,
    ApplicationRequirement,
    Borrower,
    BorrowerRegistration,
    Document,
    DocumentRequirementSatisfaction,
    DocumentType,
    LoanApplication,
    Person,
    PersonIdentifier,
)
from security.crypto import decrypt


def _decrypt_bytes(value: bytes | None) -> str | None:
    if value is None:
        return None
    return decrypt(base64.b64encode(value).decode("ascii"))


def _mask_mobile(value: str | None) -> str | None:
    return None if value is None else f"{value[:2]}{'X' * max(0, len(value) - 6)}{value[-4:]}"


def _mask_email(value: str | None) -> str | None:
    if value is None:
        return None
    local, separator, domain = value.partition("@")
    return f"{local[:1]}{'*' * max(0, len(local) - 1)}{separator}{domain}"


async def serialize_application(
    database: Any, application: LoanApplication, marketplace_id: uuid.UUID
) -> dict[str, Any]:
    requirement_count = len(
        (
            await database.scalars(
                select(ApplicationRequirement.application_requirement_id).where(
                    ApplicationRequirement.application_id == application.application_id
                )
            )
        ).all()
    )
    borrower = await database.get(Borrower, application.borrower_id)
    party_rows = (
        await database.execute(
            select(ApplicationParty, Person)
            .join(Person, Person.person_id == ApplicationParty.person_id)
            .where(
                ApplicationParty.marketplace_id == marketplace_id,
                ApplicationParty.application_id == application.application_id,
            )
            .order_by(ApplicationParty.is_primary.desc(), ApplicationParty.created_at)
        )
    ).all()
    person_ids = [party.person_id for party, _ in party_rows]
    identifier_rows = (
        (
            await database.scalars(
                select(PersonIdentifier).where(
                    PersonIdentifier.marketplace_id == marketplace_id,
                    PersonIdentifier.person_id.in_(person_ids),
                )
            )
        ).all()
        if person_ids
        else []
    )
    identifiers_by_person: dict[uuid.UUID, dict[str, str | None]] = {
        person_id: {"pan_masked": None, "aadhaar_masked": None}
        for person_id in person_ids
    }
    for identifier in identifier_rows:
        identifiers_by_person[identifier.person_id][
            f"{identifier.id_type}_masked"
        ] = identifier.masked_value
    registration_rows = (
        await database.scalars(
            select(BorrowerRegistration).where(
                BorrowerRegistration.marketplace_id == marketplace_id,
                BorrowerRegistration.borrower_id == application.borrower_id,
                BorrowerRegistration.is_primary.is_(True),
            )
        )
    ).all()
    registrations = {registration.kind: registration for registration in registration_rows}
    entity_pan = (
        registrations.get("entity_pan")
        if application.constitution in {"partnership", "private_limited"}
        else None
    )
    borrower_attributes = (borrower.attributes or {}) if borrower is not None else {}
    gstin = (
        registrations.get("gstin")
        if borrower_attributes.get("gst_registered") is True
        else None
    )
    return {
        "application_id": str(application.application_id),
        "application_no": application.application_no,
        "status": application.status,
        "current_step": "business_profile",
        "checklist_version_id": str(application.checklist_version_id),
        "requirements_count": requirement_count,
        "lock_version": application.lock_version,
        "values": {
            "constitution": application.constitution,
            "requested_amount": int(application.requested_amount or 0),
            "requested_tenure_months": application.requested_tenure_months,
            "purpose": application.purpose,
            "referral_code": (application.attributes or {}).get("referral_code"),
        },
        "business_profile": {
            "business_legal_name": borrower.legal_name if borrower is not None else None,
            "trade_name": borrower.trade_name if borrower is not None else None,
            "business_type_code": borrower.business_type_code if borrower is not None else None,
            "income_type_code": application.income_type_code,
            "type_of_office": borrower.type_of_office if borrower is not None else None,
            "location_tier": borrower.location_tier if borrower is not None else None,
            "business_pincode": (
                (borrower.operating_address or {}).get("pincode")
                if borrower is not None
                else None
            ),
            "annual_turnover_range": borrower_attributes.get("annual_turnover_range"),
            "gst_registered": borrower_attributes.get("gst_registered"),
        },
        "parties": [
            {
                "party_id": str(party.application_party_id),
                "role": party.role,
                "is_primary": party.is_primary,
                "ownership_pct": (
                    float(party.ownership_pct) if party.ownership_pct is not None else None
                ),
                "full_name": person.full_name,
                "mobile_masked": _mask_mobile(_decrypt_bytes(person.mobile_enc)),
                "email_masked": _mask_email(_decrypt_bytes(person.email_enc)),
                "type_of_residence": person.type_of_residence,
                "employment_status_code": person.employment_status_code,
                "identifiers": identifiers_by_person[person.person_id],
            }
            for party, person in party_rows
        ],
        "registrations": {
            "entity_pan_masked": entity_pan.masked_value if entity_pan is not None else None,
            "gstin_masked": gstin.masked_value if gstin is not None else None,
            "gst_state_code": gstin.state_code if gstin is not None else None,
        },
    }


async def serialize_requirements(
    database: Any, application: LoanApplication, marketplace_id: uuid.UUID
) -> dict[str, Any]:
    requirement_rows = (
        await database.scalars(
            select(ApplicationRequirement)
            .where(
                ApplicationRequirement.marketplace_id == marketplace_id,
                ApplicationRequirement.application_id == application.application_id,
            )
            .order_by(ApplicationRequirement.created_at)
        )
    ).all()
    document_type_codes = {row.document_type_code for row in requirement_rows}
    document_types = (
        {
            document_type.document_type_code: document_type
            for document_type in (
                await database.scalars(
                    select(DocumentType).where(
                        DocumentType.document_type_code.in_(document_type_codes)
                    )
                )
            ).all()
        }
        if document_type_codes
        else {}
    )
    requirement_ids = [row.application_requirement_id for row in requirement_rows]
    documents_by_requirement: dict[uuid.UUID, list[dict[str, Any]]] = {
        requirement_id: [] for requirement_id in requirement_ids
    }
    if requirement_ids:
        linked_rows = (
            await database.execute(
                select(DocumentRequirementSatisfaction, Document)
                .join(Document, Document.document_id == DocumentRequirementSatisfaction.document_id)
                .where(
                    DocumentRequirementSatisfaction.marketplace_id == marketplace_id,
                    DocumentRequirementSatisfaction.application_requirement_id.in_(requirement_ids),
                    DocumentRequirementSatisfaction.unlinked_at.is_(None),
                    Document.status == "uploaded",
                )
                .order_by(Document.uploaded_at)
            )
        ).all()
        for satisfaction, document in linked_rows:
            documents_by_requirement[satisfaction.application_requirement_id].append(
                {
                    "document_id": str(document.document_id),
                    "mime_type": document.mime_type,
                    "size_bytes": document.size_bytes,
                    "uploaded_at": (
                        document.uploaded_at.isoformat() if document.uploaded_at else None
                    ),
                    "coverage_from": (
                        document.coverage_from.isoformat() if document.coverage_from else None
                    ),
                    "coverage_to": (
                        document.coverage_to.isoformat() if document.coverage_to else None
                    ),
                }
            )

    declaration = await database.scalar(
        select(ApplicationCreditDeclaration).where(
            ApplicationCreditDeclaration.marketplace_id == marketplace_id,
            ApplicationCreditDeclaration.application_id == application.application_id,
            ApplicationCreditDeclaration.superseded_at.is_(None),
        )
    )
    facility_rows = (
        await database.scalars(
            select(ApplicationExistingCreditFacility)
            .where(
                ApplicationExistingCreditFacility.marketplace_id == marketplace_id,
                ApplicationExistingCreditFacility.application_id == application.application_id,
            )
            .order_by(ApplicationExistingCreditFacility.created_at)
        )
    ).all()

    return {
        "application_id": str(application.application_id),
        "lock_version": application.lock_version,
        "credit_declaration": {
            "has_active_credit_facilities": (
                declaration.has_active_credit_facilities if declaration is not None else None
            ),
            "declared_cibil_score": (
                declaration.declared_cibil_score if declaration is not None else None
            ),
        },
        "facilities": [
            {
                "facility_id": str(facility.facility_id),
                "facility_type": facility.facility_type,
                "lender_name": facility.lender_name,
                "original_loan_amount": (
                    float(facility.original_loan_amount)
                    if facility.original_loan_amount is not None
                    else None
                ),
                "outstanding_amount": (
                    float(facility.outstanding_amount)
                    if facility.outstanding_amount is not None
                    else None
                ),
                "emi_amount": (
                    float(facility.emi_amount) if facility.emi_amount is not None else None
                ),
                "interest_rate_percent": (
                    float(facility.interest_rate_percent)
                    if facility.interest_rate_percent is not None
                    else None
                ),
                "tenure_months": facility.tenure_months,
                "start_date": facility.start_date.isoformat() if facility.start_date else None,
                "end_date": facility.end_date.isoformat() if facility.end_date else None,
                "emis_paid_count": facility.emis_paid_count,
                "is_closed": facility.is_closed,
            }
            for facility in facility_rows
        ],
        "requirements": [
            {
                "application_requirement_id": str(row.application_requirement_id),
                "document_type_code": row.document_type_code,
                "display_name": (
                    document_types[row.document_type_code].display_name
                    if row.document_type_code in document_types
                    else row.document_type_code
                ),
                "category": (
                    document_types[row.document_type_code].category
                    if row.document_type_code in document_types
                    else None
                ),
                "attaches_to": row.attaches_to,
                "application_party_id": (
                    str(row.application_party_id) if row.application_party_id else None
                ),
                "facility_id": str(row.facility_id) if row.facility_id else None,
                "obligation": row.obligation,
                "blocks_submission": row.blocks_submission,
                "alt_group": row.alt_group,
                "coverage_mode": row.coverage_mode,
                "min_count": row.min_count,
                "required_period_from": (
                    row.required_period_from.isoformat() if row.required_period_from else None
                ),
                "required_period_to": (
                    row.required_period_to.isoformat() if row.required_period_to else None
                ),
                "fiscal_year_start": (
                    row.fiscal_year_start.isoformat() if row.fiscal_year_start else None
                ),
                "status": row.status,
                "documents": documents_by_requirement.get(row.application_requirement_id, []),
            }
            for row in requirement_rows
        ],
    }
