"""Phase 5: consent grants, masked review, and final submission."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import select

from db.collection_models import (
    ApplicationCreditDeclaration,
    ApplicationExistingCreditFacility,
    ApplicationParty,
    ApplicationRequirement,
    ApplicationStatusEvent,
    Borrower,
    BorrowerRegistration,
    ConsentGrant,
    ConsentPurpose,
    Document,
    LoanApplication,
    Person,
    PersonIdentifier,
)
from db.session import tenant_session
from models.collection_submission import ConsentGrantWrite, SubmitRequest
from services.collection_application import (
    MARKETPLACE_ID,
    ApplicationNotStartedError,
    InvalidApplicationOperationError,
    StaleApplicationError,
    _active_session,
    _advance_lock,
    _application_for_write,
)
from services.collection_requirements import _recompute_and_store_status


DEFAULT_DESTINATION_ID = uuid.UUID("40000000-0000-0000-0000-000000000001")

_SATISFIED_REQUIREMENT_STATUSES = {
    "collected",
    "accepted_for_review",
    "waived",
    "not_applicable",
}


class SubmissionIncompleteError(Exception):
    """The application does not yet satisfy every submission gate."""

    def __init__(self, missing: list[str]):
        self.missing = missing
        super().__init__("Application is not complete")


async def get_consent_status(digest: bytes) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    async with tenant_session(MARKETPLACE_ID) as database:
        browser_session = await _active_session(database, digest, now)
        if browser_session.application_id is None:
            raise ApplicationNotStartedError
        application = await database.get(
            LoanApplication, browser_session.application_id
        )
        if application is None:
            raise ApplicationNotStartedError
        browser_session.last_used_at = now
        return await _consent_snapshot(database, application)


async def save_consent_grants(
    digest: bytes, payload: ConsentGrantWrite
) -> dict[str, Any]:
    async with tenant_session(MARKETPLACE_ID) as database:
        browser_session, application = await _application_for_write(
            database, digest, payload.expected_lock_version
        )
        primary = await _primary_party(database, application)
        if primary is None:
            raise ApplicationNotStartedError

        purposes = await _current_consent_purposes(database)
        purposes_by_code = {purpose.purpose_code: purpose for purpose in purposes}
        for code in payload.grants:
            if code not in purposes_by_code:
                raise InvalidApplicationOperationError(
                    f"Unknown consent purpose '{code}'"
                )
        for purpose in purposes:
            if purpose.is_mandatory and not payload.grants.get(
                purpose.purpose_code, False
            ):
                raise InvalidApplicationOperationError(
                    f"Consent for '{purpose.purpose_code}' is mandatory"
                )

        await _advance_lock(database, application, payload.expected_lock_version)
        now = datetime.now(timezone.utc)
        for code, granted in payload.grants.items():
            purpose = purposes_by_code[code]
            database.add(
                ConsentGrant(
                    marketplace_id=MARKETPLACE_ID,
                    application_id=application.application_id,
                    person_id=primary.person_id,
                    purpose_code=code,
                    destination_id=DEFAULT_DESTINATION_ID,
                    notice_version=purpose.notice_version,
                    action="granted" if granted else "revoked",
                    occurred_at=now,
                )
            )
        browser_session.last_used_at = now
        await database.flush()
        return await _consent_snapshot(database, application)


async def submit_application(digest: bytes, payload: SubmitRequest) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    async with tenant_session(MARKETPLACE_ID) as database:
        browser_session = await _active_session(database, digest, now, lock=True)
        if browser_session.application_id is None:
            raise ApplicationNotStartedError
        application = await database.scalar(
            select(LoanApplication)
            .where(
                LoanApplication.marketplace_id == MARKETPLACE_ID,
                LoanApplication.application_id == browser_session.application_id,
            )
            .with_for_update()
        )
        if application is None:
            raise ApplicationNotStartedError

        if application.status == "submitted":
            # Idempotent resubmit: return the existing reference, never a
            # second event or a lock-version check against a value the
            # caller's last submit response already moved past.
            browser_session.last_used_at = now
            return _submission_result(application)

        if application.lock_version != payload.expected_lock_version:
            raise StaleApplicationError(application.lock_version)

        missing = await _completeness_gaps(database, application)
        if missing:
            raise SubmissionIncompleteError(missing)

        await _advance_lock(database, application, payload.expected_lock_version)
        previous_status = application.status
        application.status = "submitted"
        application.submitted_at = now
        database.add(
            ApplicationStatusEvent(
                marketplace_id=MARKETPLACE_ID,
                application_id=application.application_id,
                from_status=previous_status,
                to_status="submitted",
                reason_code="borrower_submitted",
                actor_type="borrower",
                occurred_at=now,
                metadata_={},
            )
        )
        browser_session.last_used_at = now
        await database.flush()
        return _submission_result(application)


def _submission_result(application: LoanApplication) -> dict[str, Any]:
    return {
        "application_id": str(application.application_id),
        "application_no": application.application_no,
        "status": application.status,
        "submitted_at": application.submitted_at.isoformat()
        if application.submitted_at
        else None,
        "lock_version": application.lock_version,
    }


async def _primary_party(
    database: Any, application: LoanApplication
) -> ApplicationParty | None:
    return await database.scalar(
        select(ApplicationParty).where(
            ApplicationParty.marketplace_id == MARKETPLACE_ID,
            ApplicationParty.application_id == application.application_id,
            ApplicationParty.is_primary.is_(True),
        )
    )


async def _current_consent_purposes(
    database: Any, *, mandatory_only: bool = False
) -> list[ConsentPurpose]:
    today = date.today()
    conditions = [
        (ConsentPurpose.effective_to.is_(None))
        | (ConsentPurpose.effective_to >= today),
        ConsentPurpose.effective_from <= today,
    ]
    if mandatory_only:
        conditions.append(ConsentPurpose.is_mandatory.is_(True))
    return (
        await database.scalars(
            select(ConsentPurpose)
            .where(*conditions)
            .order_by(ConsentPurpose.purpose_code)
        )
    ).all()


async def _latest_grants_by_purpose(
    database: Any, application: LoanApplication, person_id: uuid.UUID
) -> dict[str, ConsentGrant]:
    grant_rows = (
        await database.scalars(
            select(ConsentGrant)
            .where(
                ConsentGrant.marketplace_id == MARKETPLACE_ID,
                ConsentGrant.application_id == application.application_id,
                ConsentGrant.person_id == person_id,
            )
            .order_by(ConsentGrant.occurred_at)
        )
    ).all()
    latest: dict[str, ConsentGrant] = {}
    for grant in grant_rows:
        latest[grant.purpose_code] = grant
    return latest


async def _consent_snapshot(
    database: Any, application: LoanApplication
) -> dict[str, Any]:
    primary = await _primary_party(database, application)
    purposes = await _current_consent_purposes(database)
    latest = (
        await _latest_grants_by_purpose(database, application, primary.person_id)
        if primary is not None
        else {}
    )
    return {
        "application_id": str(application.application_id),
        "lock_version": application.lock_version,
        "purposes": [
            {
                "purpose_code": purpose.purpose_code,
                "display_name": purpose.display_name,
                "notice_text": purpose.notice_text,
                "notice_version": purpose.notice_version,
                "is_mandatory": purpose.is_mandatory,
                "granted": (
                    purpose.purpose_code in latest
                    and latest[purpose.purpose_code].action == "granted"
                    and latest[purpose.purpose_code].notice_version
                    == purpose.notice_version
                ),
            }
            for purpose in purposes
        ],
    }


async def _completeness_gaps(database: Any, application: LoanApplication) -> list[str]:
    missing: list[str] = []

    borrower = await database.get(Borrower, application.borrower_id)
    if borrower is None:
        return ["borrower_profile"]
    attributes = borrower.attributes or {}
    if (
        not borrower.legal_name
        or not borrower.business_type_code
        or not borrower.type_of_office
        or not borrower.location_tier
        or not (borrower.operating_address or {}).get("pincode")
        or not attributes.get("annual_turnover_range")
        or attributes.get("gst_registered") is None
        or application.income_type_code is None
    ):
        missing.append("business_profile")

    party_rows = (
        await database.scalars(
            select(ApplicationParty).where(
                ApplicationParty.marketplace_id == MARKETPLACE_ID,
                ApplicationParty.application_id == application.application_id,
            )
        )
    ).all()
    primary = next((party for party in party_rows if party.is_primary), None)
    if primary is None:
        missing.append("primary_party")

    if party_rows:
        person_rows = (
            await database.scalars(
                select(Person).where(
                    Person.marketplace_id == MARKETPLACE_ID,
                    Person.person_id.in_({party.person_id for party in party_rows}),
                )
            )
        ).all()
        people = {person.person_id: person for person in person_rows}
        for party in party_rows:
            person = people.get(party.person_id)
            if (
                person is None
                or not person.full_name
                or person.mobile_enc is None
                or person.mobile_hash is None
                or person.email_enc is None
                or person.email_hash is None
                or person.type_of_residence is None
                or person.employment_status_code is None
            ):
                missing.append(f"party_details:{party.application_party_id}")

    if party_rows:
        # Which parties actually need PAN/Aadhaar is derived from
        # application_requirements (the completeness authority), not
        # assumed for every party — a role whose KYC requirement was
        # waived or made optional must not block submission here either.
        kyc_requirement_rows = (
            await database.scalars(
                select(ApplicationRequirement).where(
                    ApplicationRequirement.marketplace_id == MARKETPLACE_ID,
                    ApplicationRequirement.application_id == application.application_id,
                    ApplicationRequirement.attaches_to == "person",
                    ApplicationRequirement.document_type_code.in_(
                        ("pan_card", "aadhaar_kyc")
                    ),
                    ApplicationRequirement.blocks_submission.is_(True),
                )
            )
        ).all()
        required_by_party: dict[uuid.UUID, set[str]] = {}
        for row in kyc_requirement_rows:
            if row.application_party_id is None:
                continue
            id_type = "pan" if row.document_type_code == "pan_card" else "aadhaar"
            required_by_party.setdefault(row.application_party_id, set()).add(id_type)

        if required_by_party:
            person_by_party = {
                party.application_party_id: party.person_id for party in party_rows
            }
            person_ids = {person_by_party[party_id] for party_id in required_by_party}
            identifier_rows = (
                await database.scalars(
                    select(PersonIdentifier).where(
                        PersonIdentifier.marketplace_id == MARKETPLACE_ID,
                        PersonIdentifier.person_id.in_(person_ids),
                        PersonIdentifier.id_type.in_(("pan", "aadhaar")),
                    )
                )
            ).all()
            present = {
                (row.person_id, row.id_type)
                for row in identifier_rows
                if row.masked_value
            }
            for party_id, id_types in required_by_party.items():
                person_id = person_by_party.get(party_id)
                for id_type in id_types:
                    if person_id is None or (person_id, id_type) not in present:
                        missing.append(f"party_{id_type}:{party_id}")

    registration_rows = (
        await database.scalars(
            select(BorrowerRegistration).where(
                BorrowerRegistration.marketplace_id == MARKETPLACE_ID,
                BorrowerRegistration.borrower_id == application.borrower_id,
                BorrowerRegistration.is_primary.is_(True),
            )
        )
    ).all()
    registrations = {row.kind: row for row in registration_rows}

    if (
        application.constitution in {"partnership", "private_limited"}
        and "entity_pan" not in registrations
    ):
        missing.append("entity_pan")

    if attributes.get("gst_registered") is True:
        gst = registrations.get("gstin")
        if gst is None or not gst.state_code:
            missing.append("gst_registration")
        active_purposes = await _current_consent_purposes(database)
        gst_purpose = next(
            (
                purpose
                for purpose in active_purposes
                if purpose.purpose_code == "gst_verification"
            ),
            None,
        )
        latest = (
            await _latest_grants_by_purpose(database, application, primary.person_id)
            if primary is not None
            else {}
        )
        gst_grant = latest.get("gst_verification")
        if (
            gst_purpose is None
            or gst_grant is None
            or gst_grant.action != "granted"
            or gst_grant.notice_version != gst_purpose.notice_version
        ):
            missing.append("consent:gst_verification")

    credit_declaration = await database.scalar(
        select(ApplicationCreditDeclaration).where(
            ApplicationCreditDeclaration.marketplace_id == MARKETPLACE_ID,
            ApplicationCreditDeclaration.application_id == application.application_id,
            ApplicationCreditDeclaration.superseded_at.is_(None),
        )
    )
    if credit_declaration is None:
        missing.append("credit_declaration")
    elif credit_declaration.has_active_credit_facilities:
        facility_id = await database.scalar(
            select(ApplicationExistingCreditFacility.facility_id).where(
                ApplicationExistingCreditFacility.marketplace_id == MARKETPLACE_ID,
                ApplicationExistingCreditFacility.application_id
                == application.application_id,
            )
        )
        if facility_id is None:
            missing.append("existing_credit_facility")

    blocking_rows = (
        await database.scalars(
            select(ApplicationRequirement).where(
                ApplicationRequirement.marketplace_id == MARKETPLACE_ID,
                ApplicationRequirement.application_id == application.application_id,
                ApplicationRequirement.blocks_submission.is_(True),
            )
        )
    ).all()
    for row in blocking_rows:
        # Never trust a denormalized requirement status at submission time.
        # Recompute from active clean-document links while the application row
        # is locked, closing stale-status and legacy-link bypasses.
        recomputed = await _recompute_and_store_status(
            database, row.application_requirement_id
        )
        if (
            recomputed is None
            or recomputed.status not in _SATISFIED_REQUIREMENT_STATUSES
        ):
            missing.append(f"requirement:{row.application_requirement_id}")

    # Any active object that has not reached the clean/promoted state blocks
    # submission, even when its intended requirement is optional or already
    # satisfied by another file. The borrower must delete failed/pending
    # uploads rather than submitting an application containing unsafe bytes.
    unsafe_document_ids = (
        await database.scalars(
            select(Document.document_id).where(
                Document.marketplace_id == MARKETPLACE_ID,
                Document.application_id == application.application_id,
                Document.status.not_in(("superseded", "purged")),
                (Document.status != "uploaded") | (Document.scan_result != "clean"),
            )
        )
    ).all()
    missing.extend(
        f"document_scan:{document_id}" for document_id in unsafe_document_ids
    )

    mandatory_purposes = await _current_consent_purposes(database, mandatory_only=True)
    if mandatory_purposes:
        latest = (
            await _latest_grants_by_purpose(database, application, primary.person_id)
            if primary is not None
            else {}
        )
        for purpose in mandatory_purposes:
            grant = latest.get(purpose.purpose_code)
            if (
                grant is None
                or grant.action != "granted"
                or grant.notice_version != purpose.notice_version
            ):
                missing.append(f"consent:{purpose.purpose_code}")

    return missing
