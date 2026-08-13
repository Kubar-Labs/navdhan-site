"""Masked application snapshots for the collection-only API."""

from __future__ import annotations

import base64
import uuid
from typing import Any

from sqlalchemy import select

from db.collection_models import (
    ApplicationParty,
    ApplicationRequirement,
    Borrower,
    BorrowerRegistration,
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
