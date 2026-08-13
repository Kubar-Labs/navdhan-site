"""Transactional collection session and initial application operations."""

from __future__ import annotations

import uuid
import hashlib
import calendar
import base64
import os
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import delete, select, update

from db.collection_models import (
    ApplicationParty,
    ApplicationRequirement,
    ApplicationSession,
    ApplicationStatusEvent,
    Borrower,
    BorrowerPerson,
    BorrowerRegistration,
    ChecklistVersion,
    DocumentRequirement,
    LoanApplication,
    Person,
    PersonIdentifier,
)
from db.session import tenant_session
from models.collection_application import (
    BusinessProfile,
    EntityPan,
    GstRegistration,
    LoanIntent,
    PartyDetails,
    PartyUpdate,
    PersonDetails,
    PersonalAadhaar,
    PersonalPan,
)
from security.crypto import encrypt
from security.lookup_hash import tenant_lookup_digest
from services.collection_snapshot import serialize_application


MARKETPLACE_ID = uuid.UUID("10000000-0000-0000-0000-000000000001")
PRODUCT_CODE = "business_loan"
SESSION_LIFETIME = timedelta(days=7)


class InvalidSessionError(Exception):
    """The supplied browser session cannot authorize a collection request."""


class ApplicationNotStartedError(Exception):
    """The valid browser session is not linked to an application yet."""


class StaleApplicationError(Exception):
    """The application changed after the caller's last read."""

    def __init__(self, current_lock_version: int):
        self.current_lock_version = current_lock_version
        super().__init__("Application version is stale")


class InvalidApplicationOperationError(Exception):
    """The requested mutation is incompatible with application state."""


class PartyNotFoundError(Exception):
    """The requested party does not belong to the current application."""


def _credential_hash(presented_digest: bytes) -> bytes:
    return hashlib.sha256(presented_digest).digest()


def _lookup_key() -> bytes:
    encoded = os.getenv("LOOKUP_HMAC_KEY")
    if not encoded:
        raise RuntimeError("Lookup hashing is not configured")
    try:
        key = base64.b64decode(encoded, validate=True)
    except ValueError as error:
        raise RuntimeError("Lookup hashing is not configured correctly") from error
    if len(key) < 32:
        raise RuntimeError("Lookup hashing is not configured correctly")
    return key


def _encrypted_bytes(value: str) -> bytes:
    return base64.b64decode(encrypt(value), validate=True)


def _mask_pan(value: str) -> str:
    return f"{value[:5]}***{value[-1]}"


def _mask_aadhaar(value: str) -> str:
    return f"XXXX XXXX {value[-4:]}"


def _mask_gstin(value: str) -> str:
    return f"{value[:2]}{'*' * max(0, len(value) - 5)}{value[-3:]}"


async def create_session(digest: bytes) -> ApplicationSession:
    now = datetime.now(timezone.utc)
    stored_hash = _credential_hash(digest)
    async with tenant_session(MARKETPLACE_ID) as database:
        existing = await database.scalar(
            select(ApplicationSession).where(ApplicationSession.token_hash == stored_hash)
        )
        if existing is not None:
            if existing.revoked_at is not None or existing.expires_at <= now:
                raise InvalidSessionError
            existing.last_used_at = now
            return existing
        browser_session = ApplicationSession(
            marketplace_id=MARKETPLACE_ID,
            token_hash=stored_hash,
            expires_at=now + SESSION_LIFETIME,
            created_at=now,
            last_used_at=now,
        )
        database.add(browser_session)
        await database.flush()
        return browser_session


async def save_loan_intent(digest: bytes, intent: LoanIntent) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    async with tenant_session(MARKETPLACE_ID) as database:
        browser_session = await _active_session(database, digest, now, lock=True)
        if browser_session.application_id is not None:
            application = await database.get(LoanApplication, browser_session.application_id)
            if application is None:
                raise InvalidSessionError
            if application.lock_version != intent.expected_lock_version:
                raise StaleApplicationError(application.lock_version)
            await _update_application(database, application, intent)
        else:
            if intent.expected_lock_version != 0:
                raise StaleApplicationError(0)
            application = await _initialize_application(database, browser_session, intent)
        browser_session.last_used_at = now
        await database.flush()
        return await serialize_application(database, application, MARKETPLACE_ID)


async def get_current_application(digest: bytes) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    async with tenant_session(MARKETPLACE_ID) as database:
        browser_session = await _active_session(database, digest, now)
        if browser_session.application_id is None:
            raise ApplicationNotStartedError
        application = await database.get(LoanApplication, browser_session.application_id)
        if application is None:
            raise ApplicationNotStartedError
        browser_session.last_used_at = now
        return await serialize_application(database, application, MARKETPLACE_ID)


async def save_business_profile(digest: bytes, profile: BusinessProfile) -> dict[str, Any]:
    async with tenant_session(MARKETPLACE_ID) as database:
        browser_session, application = await _application_for_write(
            database, digest, profile.expected_lock_version
        )
        borrower = await database.get(Borrower, application.borrower_id)
        if borrower is None:
            raise ApplicationNotStartedError
        await _advance_lock(database, application, profile.expected_lock_version)
        borrower.legal_name = profile.business_legal_name
        borrower.trade_name = profile.trade_name
        borrower.business_type_code = profile.business_type_code
        borrower.type_of_office = profile.type_of_office
        borrower.location_tier = profile.location_tier
        borrower.operating_address = {
            **(borrower.operating_address or {}),
            "pincode": profile.business_pincode,
        }
        borrower.attributes = {
            **(borrower.attributes or {}),
            "annual_turnover_range": profile.annual_turnover_range,
            "gst_registered": profile.gst_registered,
        }
        if not profile.gst_registered:
            await database.execute(
                delete(BorrowerRegistration).where(
                    BorrowerRegistration.marketplace_id == MARKETPLACE_ID,
                    BorrowerRegistration.borrower_id == application.borrower_id,
                    BorrowerRegistration.kind == "gstin",
                )
            )
        application.income_type_code = profile.income_type_code
        browser_session.last_used_at = datetime.now(timezone.utc)
        await database.flush()
        return await serialize_application(database, application, MARKETPLACE_ID)


async def save_primary_person(digest: bytes, details: PersonDetails) -> dict[str, Any]:
    async with tenant_session(MARKETPLACE_ID) as database:
        browser_session, application = await _application_for_write(
            database, digest, details.expected_lock_version
        )
        party = await database.scalar(
            select(ApplicationParty).where(
                ApplicationParty.marketplace_id == MARKETPLACE_ID,
                ApplicationParty.application_id == application.application_id,
                ApplicationParty.is_primary.is_(True),
            )
        )
        if party is None:
            raise PartyNotFoundError
        person = await database.get(Person, party.person_id)
        if person is None:
            raise PartyNotFoundError
        await _advance_lock(database, application, details.expected_lock_version)
        _apply_person_details(person, details)
        browser_session.last_used_at = datetime.now(timezone.utc)
        await database.flush()
        return await serialize_application(database, application, MARKETPLACE_ID)


async def create_application_party(digest: bytes, details: PartyDetails) -> dict[str, Any]:
    async with tenant_session(MARKETPLACE_ID) as database:
        browser_session, application = await _application_for_write(
            database, digest, details.expected_lock_version
        )
        _validate_added_party_role(application.constitution, details.role)
        await _advance_lock(database, application, details.expected_lock_version)
        person = Person(person_id=uuid.uuid4(), marketplace_id=MARKETPLACE_ID)
        _apply_person_details(person, details)
        party = ApplicationParty(
            application_party_id=uuid.uuid4(),
            marketplace_id=MARKETPLACE_ID,
            application_id=application.application_id,
            person_id=person.person_id,
            role=details.role,
            is_primary=False,
            ownership_pct=details.ownership_pct,
        )
        relationship = BorrowerPerson(
            marketplace_id=MARKETPLACE_ID,
            borrower_id=application.borrower_id,
            person_id=person.person_id,
            role=details.role,
            ownership_pct=details.ownership_pct,
            effective_from=date.today(),
        )
        database.add(person)
        await database.flush()
        database.add_all((party, relationship))
        await database.flush()
        await _materialize_party_requirements(database, application, party)
        browser_session.last_used_at = datetime.now(timezone.utc)
        await database.flush()
        return await serialize_application(database, application, MARKETPLACE_ID)


async def update_application_party(
    digest: bytes, party_id: uuid.UUID, details: PartyUpdate
) -> dict[str, Any]:
    async with tenant_session(MARKETPLACE_ID) as database:
        browser_session, application = await _application_for_write(
            database, digest, details.expected_lock_version
        )
        party = await _party_for_application(database, application, party_id)
        if party.is_primary:
            raise InvalidApplicationOperationError("Use the primary-person endpoint")
        person = await database.get(Person, party.person_id)
        if person is None:
            raise PartyNotFoundError
        await _advance_lock(database, application, details.expected_lock_version)
        _apply_person_details(person, details)
        party.ownership_pct = details.ownership_pct
        relationship = await database.scalar(
            select(BorrowerPerson).where(
                BorrowerPerson.marketplace_id == MARKETPLACE_ID,
                BorrowerPerson.borrower_id == application.borrower_id,
                BorrowerPerson.person_id == party.person_id,
                BorrowerPerson.role == party.role,
                BorrowerPerson.effective_to.is_(None),
            )
        )
        if relationship is None:
            raise InvalidApplicationOperationError("Party relationship is missing")
        relationship.ownership_pct = details.ownership_pct
        browser_session.last_used_at = datetime.now(timezone.utc)
        await database.flush()
        return await serialize_application(database, application, MARKETPLACE_ID)


async def save_personal_pan(
    digest: bytes, party_id: uuid.UUID, payload: PersonalPan
) -> dict[str, Any]:
    return await _save_person_identifier(
        digest, party_id, payload.expected_lock_version, "pan", payload.pan_number
    )


async def save_personal_aadhaar(
    digest: bytes, party_id: uuid.UUID, payload: PersonalAadhaar
) -> dict[str, Any]:
    return await _save_person_identifier(
        digest, party_id, payload.expected_lock_version, "aadhaar", payload.aadhaar_number
    )


async def save_entity_pan(digest: bytes, payload: EntityPan) -> dict[str, Any]:
    async with tenant_session(MARKETPLACE_ID) as database:
        browser_session, application = await _application_for_write(
            database, digest, payload.expected_lock_version
        )
        if application.constitution not in {"partnership", "private_limited"}:
            raise InvalidApplicationOperationError(
                "Entity PAN is not collected for this constitution"
            )
        value_hash = tenant_lookup_digest(
            _lookup_key(), MARKETPLACE_ID, payload.entity_pan
        )
        conflicting_identifier = await database.scalar(
            select(PersonIdentifier.identifier_id)
            .join(
                ApplicationParty,
                ApplicationParty.person_id == PersonIdentifier.person_id,
            )
            .where(
                PersonIdentifier.marketplace_id == MARKETPLACE_ID,
                PersonIdentifier.id_type == "pan",
                PersonIdentifier.value_hash == value_hash,
                ApplicationParty.marketplace_id == MARKETPLACE_ID,
                ApplicationParty.application_id == application.application_id,
            )
            .limit(1)
        )
        if conflicting_identifier is not None:
            raise InvalidApplicationOperationError("Identifier ownership conflict")
        await _advance_lock(database, application, payload.expected_lock_version)
        await _upsert_registration(
            database, application.borrower_id, "entity_pan", payload.entity_pan
        )
        browser_session.last_used_at = datetime.now(timezone.utc)
        await database.flush()
        return await serialize_application(database, application, MARKETPLACE_ID)


async def save_gst_registration(
    digest: bytes, payload: GstRegistration
) -> dict[str, Any]:
    async with tenant_session(MARKETPLACE_ID) as database:
        browser_session, application = await _application_for_write(
            database, digest, payload.expected_lock_version
        )
        await _advance_lock(database, application, payload.expected_lock_version)
        borrower = await database.get(Borrower, application.borrower_id)
        if borrower is None:
            raise ApplicationNotStartedError
        borrower.attributes = {
            **(borrower.attributes or {}),
            "gst_registered": payload.gst_registered,
        }
        if payload.gstin is not None:
            await _upsert_registration(
                database,
                application.borrower_id,
                "gstin",
                payload.gstin,
                state_code=payload.state_code,
            )
        else:
            await database.execute(
                delete(BorrowerRegistration).where(
                    BorrowerRegistration.marketplace_id == MARKETPLACE_ID,
                    BorrowerRegistration.borrower_id == application.borrower_id,
                    BorrowerRegistration.kind == "gstin",
                )
            )
        browser_session.last_used_at = datetime.now(timezone.utc)
        await database.flush()
        return await serialize_application(database, application, MARKETPLACE_ID)


async def _application_for_write(
    database: Any, digest: bytes, expected_lock_version: int
) -> tuple[ApplicationSession, LoanApplication]:
    now = datetime.now(timezone.utc)
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
    if application.lock_version != expected_lock_version:
        raise StaleApplicationError(application.lock_version)
    return browser_session, application


async def _advance_lock(
    database: Any, application: LoanApplication, expected_lock_version: int
) -> None:
    result = await database.execute(
        update(LoanApplication)
        .where(
            LoanApplication.marketplace_id == MARKETPLACE_ID,
            LoanApplication.application_id == application.application_id,
            LoanApplication.lock_version == expected_lock_version,
        )
        .values(
            lock_version=expected_lock_version + 1,
            updated_at=datetime.now(timezone.utc),
        )
    )
    if result.rowcount != 1:
        await database.refresh(application)
        raise StaleApplicationError(application.lock_version)
    application.lock_version = expected_lock_version + 1


def _apply_person_details(person: Person, details: PersonDetails) -> None:
    mobile = details.mobile_number
    email = details.email.lower()
    lookup_key = _lookup_key()
    person.full_name = details.full_name
    person.mobile_enc = _encrypted_bytes(mobile)
    person.mobile_hash = tenant_lookup_digest(lookup_key, MARKETPLACE_ID, mobile)
    person.email_enc = _encrypted_bytes(email)
    person.email_hash = tenant_lookup_digest(lookup_key, MARKETPLACE_ID, email)
    person.type_of_residence = details.type_of_residence
    person.employment_status_code = details.employment_status_code


def _validate_added_party_role(constitution: str, role: str) -> None:
    allowed_role = {
        "partnership": "co_applicant",
        "private_limited": "director",
    }.get(constitution)
    if role != allowed_role:
        raise InvalidApplicationOperationError(
            "Party role is not allowed for this constitution"
        )


async def _party_for_application(
    database: Any, application: LoanApplication, party_id: uuid.UUID
) -> ApplicationParty:
    party = await database.scalar(
        select(ApplicationParty).where(
            ApplicationParty.marketplace_id == MARKETPLACE_ID,
            ApplicationParty.application_id == application.application_id,
            ApplicationParty.application_party_id == party_id,
        )
    )
    if party is None:
        raise PartyNotFoundError
    return party


async def _save_person_identifier(
    digest: bytes,
    party_id: uuid.UUID,
    expected_lock_version: int,
    identifier_type: str,
    value: str,
) -> dict[str, Any]:
    async with tenant_session(MARKETPLACE_ID) as database:
        browser_session, application = await _application_for_write(
            database, digest, expected_lock_version
        )
        party = await _party_for_application(database, application, party_id)
        value_hash = tenant_lookup_digest(_lookup_key(), MARKETPLACE_ID, value)
        if identifier_type == "pan":
            conflicting_registration = await database.scalar(
                select(BorrowerRegistration.registration_id)
                .where(
                    BorrowerRegistration.marketplace_id == MARKETPLACE_ID,
                    BorrowerRegistration.borrower_id == application.borrower_id,
                    BorrowerRegistration.kind == "entity_pan",
                    BorrowerRegistration.value_hash == value_hash,
                )
                .limit(1)
            )
            if conflicting_registration is not None:
                raise InvalidApplicationOperationError("Identifier ownership conflict")
        await _advance_lock(database, application, expected_lock_version)
        identifier = await database.scalar(
            select(PersonIdentifier).where(
                PersonIdentifier.marketplace_id == MARKETPLACE_ID,
                PersonIdentifier.person_id == party.person_id,
                PersonIdentifier.id_type == identifier_type,
            )
        )
        masked = _mask_pan(value) if identifier_type == "pan" else _mask_aadhaar(value)
        if identifier is None:
            identifier = PersonIdentifier(
                identifier_id=uuid.uuid4(),
                marketplace_id=MARKETPLACE_ID,
                person_id=party.person_id,
                id_type=identifier_type,
                source="manual_entry",
                verification_state="not_attempted",
            )
            database.add(identifier)
        identifier.value_enc = _encrypted_bytes(value)
        identifier.value_hash = value_hash
        identifier.masked_value = masked
        browser_session.last_used_at = datetime.now(timezone.utc)
        await database.flush()
        return await serialize_application(database, application, MARKETPLACE_ID)


async def _upsert_registration(
    database: Any,
    borrower_id: uuid.UUID,
    kind: str,
    value: str,
    *,
    state_code: str | None = None,
) -> None:
    registration = await database.scalar(
        select(BorrowerRegistration).where(
            BorrowerRegistration.marketplace_id == MARKETPLACE_ID,
            BorrowerRegistration.borrower_id == borrower_id,
            BorrowerRegistration.kind == kind,
            BorrowerRegistration.is_primary.is_(True),
        )
    )
    masked = _mask_pan(value) if kind == "entity_pan" else _mask_gstin(value)
    if registration is None:
        registration = BorrowerRegistration(
            registration_id=uuid.uuid4(),
            marketplace_id=MARKETPLACE_ID,
            borrower_id=borrower_id,
            kind=kind,
            is_primary=True,
            verification_state="not_attempted",
        )
        database.add(registration)
    registration.value_enc = _encrypted_bytes(value)
    registration.value_hash = tenant_lookup_digest(_lookup_key(), MARKETPLACE_ID, value)
    registration.masked_value = masked
    registration.state_code = state_code


async def _active_session(database: Any, digest: bytes, now: datetime, *, lock: bool = False) -> ApplicationSession:
    query = select(ApplicationSession).where(
        ApplicationSession.marketplace_id == MARKETPLACE_ID,
        ApplicationSession.token_hash == _credential_hash(digest),
        ApplicationSession.revoked_at.is_(None),
        ApplicationSession.expires_at > now,
    )
    if lock:
        query = query.with_for_update()
    browser_session = await database.scalar(query)
    if browser_session is None:
        raise InvalidSessionError
    return browser_session


async def _active_checklist(database: Any, constitution: str) -> ChecklistVersion:
    checklist = await database.scalar(
        select(ChecklistVersion)
        .where(
            ChecklistVersion.marketplace_id == MARKETPLACE_ID,
            ChecklistVersion.product_code == PRODUCT_CODE,
            ChecklistVersion.constitution == constitution,
            ChecklistVersion.status == "active",
            ChecklistVersion.effective_from <= date.today(),
            (ChecklistVersion.effective_to.is_(None) | (ChecklistVersion.effective_to >= date.today())),
        )
        .order_by(ChecklistVersion.version_no.desc())
        .limit(1)
    )
    if checklist is None:
        raise RuntimeError("No active checklist for the requested application")
    return checklist


async def _initialize_application(
    database: Any, browser_session: ApplicationSession, intent: LoanIntent
) -> LoanApplication:
    checklist = await _active_checklist(database, intent.constitution)
    borrower_id, person_id, application_id, party_id = (uuid.uuid4() for _ in range(4))
    application_suffix = uuid.uuid4().hex[:12].upper()
    primary_role = "director" if intent.constitution == "private_limited" else "applicant"

    borrower = Borrower(
        borrower_id=borrower_id,
        marketplace_id=MARKETPLACE_ID,
        external_ref=f"browser-{application_suffix.lower()}",
        constitution=intent.constitution,
    )
    person = Person(person_id=person_id, marketplace_id=MARKETPLACE_ID)
    relationship = BorrowerPerson(
        marketplace_id=MARKETPLACE_ID,
        borrower_id=borrower_id,
        person_id=person_id,
        role=primary_role,
        effective_from=date.today(),
    )
    application = LoanApplication(
        application_id=application_id,
        marketplace_id=MARKETPLACE_ID,
        borrower_id=borrower_id,
        application_no=f"ND-{application_suffix}",
        product_code=PRODUCT_CODE,
        constitution=intent.constitution,
        checklist_version_id=checklist.checklist_version_id,
        requested_amount=intent.requested_amount,
        requested_tenure_months=intent.requested_tenure_months,
        purpose=intent.purpose,
        channel="webapp",
        attributes={"referral_code": intent.referral_code},
    )
    party = ApplicationParty(
        application_party_id=party_id,
        marketplace_id=MARKETPLACE_ID,
        application_id=application_id,
        person_id=person_id,
        role=primary_role,
        is_primary=True,
    )
    database.add_all((borrower, person))
    await database.flush()
    database.add_all((relationship, application))
    await database.flush()
    database.add(party)
    await database.flush()
    await _materialize_requirements(database, application, party)
    database.add(
        ApplicationStatusEvent(
            marketplace_id=MARKETPLACE_ID,
            application_id=application_id,
            to_status="in_progress",
            reason_code="application_started",
            actor_type="borrower",
            metadata_={},
        )
    )
    browser_session.application_id = application_id
    return application


async def _update_application(database: Any, application: LoanApplication, intent: LoanIntent) -> None:
    next_version = intent.expected_lock_version + 1
    constitution_changed = application.constitution != intent.constitution
    if constitution_changed:
        additional_party_exists = await database.scalar(
            select(ApplicationParty.application_party_id).where(
                ApplicationParty.marketplace_id == MARKETPLACE_ID,
                ApplicationParty.application_id == application.application_id,
                ApplicationParty.is_primary.is_(False),
            )
        )
        if additional_party_exists is not None:
            raise InvalidApplicationOperationError(
                "Constitution cannot change after additional parties are added"
            )
    checklist = (
        await _active_checklist(database, intent.constitution)
        if constitution_changed
        else None
    )
    update_values = {
        "requested_amount": intent.requested_amount,
        "requested_tenure_months": intent.requested_tenure_months,
        "purpose": intent.purpose,
        "attributes": {
            **(application.attributes or {}),
            "referral_code": intent.referral_code,
        },
        "lock_version": next_version,
        "updated_at": datetime.now(timezone.utc),
    }
    if checklist is not None:
        update_values.update(
            constitution=intent.constitution,
            checklist_version_id=checklist.checklist_version_id,
        )
    result = await database.execute(
        update(LoanApplication)
        .where(
            LoanApplication.application_id == application.application_id,
            LoanApplication.marketplace_id == MARKETPLACE_ID,
            LoanApplication.lock_version == intent.expected_lock_version,
        )
        .values(**update_values)
    )
    if result.rowcount != 1:
        await database.refresh(application)
        raise StaleApplicationError(application.lock_version)
    if constitution_changed:
        await database.refresh(application)
        borrower = await database.get(Borrower, application.borrower_id)
        if borrower is not None:
            borrower.constitution = intent.constitution
        if intent.constitution == "proprietorship":
            await database.execute(
                delete(BorrowerRegistration).where(
                    BorrowerRegistration.marketplace_id == MARKETPLACE_ID,
                    BorrowerRegistration.borrower_id == application.borrower_id,
                    BorrowerRegistration.kind == "entity_pan",
                )
            )
        party = await database.scalar(
            select(ApplicationParty).where(
                ApplicationParty.application_id == application.application_id,
                ApplicationParty.is_primary.is_(True),
            )
        )
        if party is None:
            raise RuntimeError("Application has no primary party")
        primary_role = "director" if intent.constitution == "private_limited" else "applicant"
        party.role = primary_role
        relationship = await database.scalar(
            select(BorrowerPerson).where(
                BorrowerPerson.borrower_id == application.borrower_id,
                BorrowerPerson.person_id == party.person_id,
                BorrowerPerson.effective_to.is_(None),
            )
        )
        if relationship is None:
            raise RuntimeError("Application has no active primary relationship")
        relationship.role = primary_role
        await database.execute(
            delete(ApplicationRequirement).where(
                ApplicationRequirement.application_id == application.application_id
            )
        )
        await database.flush()
        await _materialize_requirements(database, application, party)
    await database.refresh(application)


async def _materialize_requirements(
    database: Any, application: LoanApplication, party: ApplicationParty
) -> None:
    requirements = (
        await database.scalars(
            select(DocumentRequirement).where(
                DocumentRequirement.marketplace_id == MARKETPLACE_ID,
                DocumentRequirement.checklist_version_id == application.checklist_version_id,
            )
        )
    ).all()
    for requirement in requirements:
        if requirement.attaches_to == "facility":
            continue
        if requirement.party_role == "co_applicant":
            continue
        if requirement.attaches_to == "person" and requirement.party_role != party.role:
            continue
        period_from, period_to, fiscal_year_start = _coverage_snapshot(requirement, date.today())
        database.add(
            ApplicationRequirement(
                marketplace_id=MARKETPLACE_ID,
                application_id=application.application_id,
                requirement_id=requirement.requirement_id,
                document_type_code=requirement.document_type_code,
                attaches_to=requirement.attaches_to,
                application_party_id=(
                    party.application_party_id if requirement.attaches_to == "person" else None
                ),
                obligation=requirement.obligation,
                blocks_submission=requirement.blocks_submission,
                alt_group=requirement.alt_group,
                coverage_mode=requirement.coverage_mode,
                min_count=requirement.min_count,
                required_period_from=period_from,
                required_period_to=period_to,
                fiscal_year_start=fiscal_year_start,
                status="pending",
                cached_coverage_state={},
            )
        )


async def _materialize_party_requirements(
    database: Any, application: LoanApplication, party: ApplicationParty
) -> None:
    requirements = (
        await database.scalars(
            select(DocumentRequirement).where(
                DocumentRequirement.marketplace_id == MARKETPLACE_ID,
                DocumentRequirement.checklist_version_id == application.checklist_version_id,
                DocumentRequirement.attaches_to == "person",
                DocumentRequirement.party_role == party.role,
            )
        )
    ).all()
    for requirement in requirements:
        period_from, period_to, fiscal_year_start = _coverage_snapshot(
            requirement, date.today()
        )
        database.add(
            ApplicationRequirement(
                marketplace_id=MARKETPLACE_ID,
                application_id=application.application_id,
                requirement_id=requirement.requirement_id,
                document_type_code=requirement.document_type_code,
                attaches_to="person",
                application_party_id=party.application_party_id,
                obligation=requirement.obligation,
                blocks_submission=requirement.blocks_submission,
                alt_group=requirement.alt_group,
                coverage_mode=requirement.coverage_mode,
                min_count=requirement.min_count,
                required_period_from=period_from,
                required_period_to=period_to,
                fiscal_year_start=fiscal_year_start,
                status="pending",
                cached_coverage_state={},
            )
        )


def _shift_months(value: date, months: int) -> date:
    absolute_month = value.year * 12 + value.month - 1 + months
    year, zero_based_month = divmod(absolute_month, 12)
    month = zero_based_month + 1
    return date(year, month, min(value.day, calendar.monthrange(year, month)[1]))


def _coverage_snapshot(
    requirement: DocumentRequirement, application_date: date
) -> tuple[date | None, date | None, date | None]:
    if requirement.fixed_period_start is not None:
        return requirement.fixed_period_start, application_date, None
    if requirement.coverage_mode == "month_range" and requirement.lookback_months:
        return _shift_months(application_date, -requirement.lookback_months), application_date, None
    if requirement.coverage_mode == "fiscal_year" and requirement.lookback_months:
        current_fiscal_start = date(
            application_date.year if application_date.month >= 4 else application_date.year - 1,
            4,
            1,
        )
        window_start = _shift_months(current_fiscal_start, -requirement.lookback_months)
        return window_start, current_fiscal_start - timedelta(days=1), window_start
    return None, None, None
