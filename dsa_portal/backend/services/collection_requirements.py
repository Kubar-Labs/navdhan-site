"""Phase 4: dynamic requirements, document upload/linking, and existing-credit facilities."""

from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import delete, select

from db.collection_models import (
    ApplicationCreditDeclaration,
    ApplicationExistingCreditFacility,
    ApplicationParty,
    ApplicationRequirement,
    ApplicationRequirementEvent,
    Document,
    DocumentEvent,
    DocumentRequirement,
    DocumentRequirementSatisfaction,
    DocumentType,
    DocumentTypeMimeType,
    LoanApplication,
)
from db.session import tenant_session
from models.collection_requirements import CreditDeclaration, CreditFacility
from services.collection_application import (
    MARKETPLACE_ID,
    ApplicationNotStartedError,
    InvalidApplicationOperationError,
    _active_session,
    _advance_lock,
    _application_for_write,
)
from services.collection_snapshot import serialize_requirements
from storage.local_documents import (
    DocumentEmptyError,
    DocumentInvalidPdfError,
    DocumentTooLargeError,
    LocalDocumentStorage,
    validate_pdf_bytes,
)


_STORAGE = LocalDocumentStorage()
_TERMINAL_STATUSES = ("waived", "not_applicable")
_LOGGER = logging.getLogger(__name__)


def _remove_stored_objects(object_keys: list[str]) -> None:
    """Delete files for purged documents, only after the transaction committed.

    Physical deletion must never run inside the transaction: a later rollback
    would leave a live document row pointing at a file that no longer exists.
    Running it here — after the `tenant_session` context manager has
    committed — means a rollback simply leaves the file in place.

    The inverse failure is safe by construction: if deletion fails after a
    successful commit, the file is merely orphaned (wasted disk, never a
    broken reference), so this logs and continues instead of raising, which
    would otherwise report a failure for work the database already committed.
    """
    for object_key in object_keys:
        try:
            _STORAGE.delete(object_key=object_key)
        except Exception:
            _LOGGER.exception(
                "Post-commit document cleanup failed for object key %s", object_key
            )


class RequirementNotFoundError(Exception):
    """The requested application requirement does not belong to the application."""


class DocumentNotFoundError(Exception):
    """The requested document does not belong to the application."""


class DocumentValidationError(Exception):
    """The uploaded file failed validation (size, MIME, or PDF signature)."""


async def get_requirements(digest: bytes) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    async with tenant_session(MARKETPLACE_ID) as database:
        browser_session = await _active_session(database, digest, now)
        if browser_session.application_id is None:
            raise ApplicationNotStartedError
        application = await database.get(LoanApplication, browser_session.application_id)
        if application is None:
            raise ApplicationNotStartedError
        browser_session.last_used_at = now
        return await serialize_requirements(database, application, MARKETPLACE_ID)


async def save_credit_declaration(digest: bytes, payload: CreditDeclaration) -> dict[str, Any]:
    removable_object_keys: list[str] = []
    async with tenant_session(MARKETPLACE_ID) as database:
        browser_session, application = await _application_for_write(
            database, digest, payload.expected_lock_version
        )
        primary_party = await database.scalar(
            select(ApplicationParty).where(
                ApplicationParty.marketplace_id == MARKETPLACE_ID,
                ApplicationParty.application_id == application.application_id,
                ApplicationParty.is_primary.is_(True),
            )
        )
        if primary_party is None:
            raise ApplicationNotStartedError
        await _advance_lock(database, application, payload.expected_lock_version)
        now = datetime.now(timezone.utc)
        previous = await database.scalar(
            select(ApplicationCreditDeclaration).where(
                ApplicationCreditDeclaration.marketplace_id == MARKETPLACE_ID,
                ApplicationCreditDeclaration.application_id == application.application_id,
                ApplicationCreditDeclaration.superseded_at.is_(None),
            )
        )
        was_active = previous.has_active_credit_facilities if previous is not None else False
        if previous is not None:
            previous.superseded_at = now
        database.add(
            ApplicationCreditDeclaration(
                marketplace_id=MARKETPLACE_ID,
                application_id=application.application_id,
                application_party_id=primary_party.application_party_id,
                declared_cibil_score=payload.declared_cibil_score,
                has_active_credit_facilities=payload.has_active_credit_facilities,
                declared_at=now,
            )
        )
        if was_active and not payload.has_active_credit_facilities:
            removable_object_keys = await _clear_facilities(database, application)
        browser_session.last_used_at = now
        await database.flush()
        snapshot = await serialize_requirements(database, application, MARKETPLACE_ID)
    _remove_stored_objects(removable_object_keys)
    return snapshot


async def create_credit_facility(digest: bytes, payload: CreditFacility) -> dict[str, Any]:
    async with tenant_session(MARKETPLACE_ID) as database:
        browser_session, application = await _application_for_write(
            database, digest, payload.expected_lock_version
        )
        declaration = await database.scalar(
            select(ApplicationCreditDeclaration).where(
                ApplicationCreditDeclaration.marketplace_id == MARKETPLACE_ID,
                ApplicationCreditDeclaration.application_id == application.application_id,
                ApplicationCreditDeclaration.superseded_at.is_(None),
            )
        )
        if declaration is None or not declaration.has_active_credit_facilities:
            raise InvalidApplicationOperationError(
                "Declare active credit facilities before adding one"
            )
        await _advance_lock(database, application, payload.expected_lock_version)
        now = datetime.now(timezone.utc)
        facility = ApplicationExistingCreditFacility(
            marketplace_id=MARKETPLACE_ID,
            application_id=application.application_id,
            facility_type=payload.facility_type,
            lender_name=payload.lender_name,
            original_loan_amount=payload.original_loan_amount,
            outstanding_amount=payload.outstanding_amount,
            emi_amount=payload.emi_amount,
            interest_rate_percent=payload.interest_rate_percent,
            tenure_months=payload.tenure_months,
            start_date=payload.start_date,
            end_date=payload.end_date,
            emis_paid_count=payload.emis_paid_count,
            total_amount_paid=payload.total_amount_paid,
            is_closed=payload.is_closed,
            declared_at=now,
        )
        database.add(facility)
        await database.flush()
        await _materialize_facility_requirements(database, application, facility)
        browser_session.last_used_at = now
        await database.flush()
        return await serialize_requirements(database, application, MARKETPLACE_ID)


async def upload_document(
    digest: bytes,
    *,
    application_requirement_id: uuid.UUID,
    expected_lock_version: int,
    file_bytes: bytes,
    mime_type: str,
    filename: str | None,
    coverage_from: date | None,
    coverage_to: date | None,
    supersedes_document_id: uuid.UUID | None,
) -> dict[str, Any]:
    async with tenant_session(MARKETPLACE_ID) as database:
        browser_session, application = await _application_for_write(
            database, digest, expected_lock_version
        )
        requirement = await database.scalar(
            select(ApplicationRequirement).where(
                ApplicationRequirement.marketplace_id == MARKETPLACE_ID,
                ApplicationRequirement.application_id == application.application_id,
                ApplicationRequirement.application_requirement_id == application_requirement_id,
            )
        )
        if requirement is None:
            raise RequirementNotFoundError

        document_type = await database.get(DocumentType, requirement.document_type_code)
        if document_type is None:
            raise RequirementNotFoundError
        allowed_mimes = (
            await database.scalars(
                select(DocumentTypeMimeType.mime_type).where(
                    DocumentTypeMimeType.document_type_code == requirement.document_type_code
                )
            )
        ).all()
        if mime_type not in allowed_mimes:
            raise DocumentValidationError("Unsupported file type for this document")

        old_document: Document | None = None
        if supersedes_document_id is not None:
            old_document = await database.scalar(
                select(Document).where(
                    Document.marketplace_id == MARKETPLACE_ID,
                    Document.application_id == application.application_id,
                    Document.document_id == supersedes_document_id,
                    Document.document_type_code == requirement.document_type_code,
                    Document.attaches_to == requirement.attaches_to,
                )
            )
            if old_document is None:
                raise DocumentNotFoundError

        try:
            validate_pdf_bytes(
                file_bytes,
                mime_type=mime_type,
                filename=filename,
                max_size_bytes=document_type.max_size_bytes,
            )
        except (DocumentEmptyError, DocumentTooLargeError, DocumentInvalidPdfError) as error:
            raise DocumentValidationError(str(error) or "Invalid document") from error

        await _advance_lock(database, application, expected_lock_version)
        now = datetime.now(timezone.utc)
        document_id = uuid.uuid4()

        try:
            stored = _STORAGE.save(
                marketplace_id=MARKETPLACE_ID,
                application_id=application.application_id,
                document_id=document_id,
                data=file_bytes,
            )
        except OSError as error:
            raise DocumentValidationError("Could not store the uploaded file") from error

        fiscal_year_start = None
        if requirement.coverage_mode == "fiscal_year" and coverage_from is not None:
            fiscal_year_start = date(
                coverage_from.year if coverage_from.month >= 4 else coverage_from.year - 1, 4, 1
            )

        document = Document(
            document_id=document_id,
            marketplace_id=MARKETPLACE_ID,
            application_id=application.application_id,
            document_type_code=requirement.document_type_code,
            attaches_to=requirement.attaches_to,
            borrower_id=(
                application.borrower_id if requirement.attaches_to == "entity" else None
            ),
            application_party_id=(
                requirement.application_party_id if requirement.attaches_to == "person" else None
            ),
            facility_id=(
                requirement.facility_id if requirement.attaches_to == "facility" else None
            ),
            gcs_bucket=stored.bucket,
            gcs_object=stored.object_key,
            sha256=stored.sha256,
            mime_type=mime_type,
            size_bytes=stored.size_bytes,
            coverage_from=coverage_from,
            coverage_to=coverage_to,
            fiscal_year_start=fiscal_year_start,
            status="uploaded",
            supersedes_document_id=supersedes_document_id,
            idempotency_key=str(document_id),
            uploaded_by_type="borrower",
            uploaded_at=now,
        )
        try:
            database.add(document)
            await database.flush()
        except Exception:
            _STORAGE.delete(object_key=stored.object_key)
            raise

        database.add(
            DocumentEvent(
                marketplace_id=MARKETPLACE_ID,
                document_id=document_id,
                event_type="uploaded",
                actor_type="borrower",
                occurred_at=now,
            )
        )

        if old_document is not None:
            live_links = (
                await database.scalars(
                    select(DocumentRequirementSatisfaction).where(
                        DocumentRequirementSatisfaction.marketplace_id == MARKETPLACE_ID,
                        DocumentRequirementSatisfaction.document_id == old_document.document_id,
                        DocumentRequirementSatisfaction.unlinked_at.is_(None),
                    )
                )
            ).all()
            for link in live_links:
                link.unlinked_at = now
                link.unlink_reason = "superseded"
            old_document.status = "superseded"
            old_document.updated_at = now
            database.add(
                DocumentEvent(
                    marketplace_id=MARKETPLACE_ID,
                    document_id=old_document.document_id,
                    event_type="superseded",
                    actor_type="borrower",
                    occurred_at=now,
                )
            )

        await _link_document_to_requirement(database, application, document, requirement)

        browser_session.last_used_at = now
        await database.flush()
        return await serialize_requirements(database, application, MARKETPLACE_ID)


async def delete_document(
    digest: bytes, document_id: uuid.UUID, expected_lock_version: int
) -> dict[str, Any]:
    async with tenant_session(MARKETPLACE_ID) as database:
        browser_session, application = await _application_for_write(
            database, digest, expected_lock_version
        )
        document = await database.scalar(
            select(Document).where(
                Document.marketplace_id == MARKETPLACE_ID,
                Document.application_id == application.application_id,
                Document.document_id == document_id,
            )
        )
        if document is None or document.status == "purged":
            raise DocumentNotFoundError
        await _advance_lock(database, application, expected_lock_version)
        now = datetime.now(timezone.utc)
        live_links = (
            await database.scalars(
                select(DocumentRequirementSatisfaction).where(
                    DocumentRequirementSatisfaction.marketplace_id == MARKETPLACE_ID,
                    DocumentRequirementSatisfaction.document_id == document_id,
                    DocumentRequirementSatisfaction.unlinked_at.is_(None),
                )
            )
        ).all()
        affected_requirement_ids = {link.application_requirement_id for link in live_links}
        for link in live_links:
            link.unlinked_at = now
            link.unlink_reason = "deleted_by_borrower"
        document.status = "purged"
        document.purged_at = now
        document.updated_at = now
        database.add(
            DocumentEvent(
                marketplace_id=MARKETPLACE_ID,
                document_id=document_id,
                event_type="purged",
                actor_type="borrower",
                occurred_at=now,
            )
        )
        await database.flush()
        for requirement_id in affected_requirement_ids:
            requirement = await _recompute_and_store_status(database, requirement_id)
            if requirement is not None and requirement.alt_group and requirement.status != "collected":
                await _revert_alt_group_if_unsatisfied(
                    database, application.application_id, requirement.alt_group
                )
        # Capture the key inside the transaction, delete the file after it
        # commits — see _remove_stored_objects.
        removable_object_keys = [document.gcs_object]
        browser_session.last_used_at = now
        await database.flush()
        snapshot = await serialize_requirements(database, application, MARKETPLACE_ID)
    _remove_stored_objects(removable_object_keys)
    return snapshot


async def _clear_facilities(database: Any, application: LoanApplication) -> list[str]:
    """Remove declared facilities and their documents; return files to delete.

    Returns the storage object keys of the removed documents rather than
    deleting them here, so the caller can run physical deletion only after
    the surrounding transaction commits.
    """
    facility_ids = (
        await database.scalars(
            select(ApplicationExistingCreditFacility.facility_id).where(
                ApplicationExistingCreditFacility.marketplace_id == MARKETPLACE_ID,
                ApplicationExistingCreditFacility.application_id == application.application_id,
            )
        )
    ).all()
    if not facility_ids:
        return []
    requirement_ids = (
        await database.scalars(
            select(ApplicationRequirement.application_requirement_id).where(
                ApplicationRequirement.marketplace_id == MARKETPLACE_ID,
                ApplicationRequirement.application_id == application.application_id,
                ApplicationRequirement.facility_id.in_(facility_ids),
            )
        )
    ).all()
    documents = (
        await database.scalars(
            select(Document).where(
                Document.marketplace_id == MARKETPLACE_ID,
                Document.application_id == application.application_id,
                Document.facility_id.in_(facility_ids),
            )
        )
    ).all()
    document_ids = [document.document_id for document in documents]
    removable_object_keys = [document.gcs_object for document in documents]
    if requirement_ids:
        await database.execute(
            delete(DocumentRequirementSatisfaction).where(
                DocumentRequirementSatisfaction.marketplace_id == MARKETPLACE_ID,
                DocumentRequirementSatisfaction.application_requirement_id.in_(requirement_ids),
            )
        )
        await database.execute(
            delete(ApplicationRequirementEvent).where(
                ApplicationRequirementEvent.marketplace_id == MARKETPLACE_ID,
                ApplicationRequirementEvent.application_requirement_id.in_(requirement_ids),
            )
        )
    if document_ids:
        await database.execute(
            delete(DocumentEvent).where(
                DocumentEvent.marketplace_id == MARKETPLACE_ID,
                DocumentEvent.document_id.in_(document_ids),
            )
        )
        await database.execute(
            delete(Document).where(
                Document.marketplace_id == MARKETPLACE_ID,
                Document.document_id.in_(document_ids),
            )
        )
    if requirement_ids:
        await database.execute(
            delete(ApplicationRequirement).where(
                ApplicationRequirement.marketplace_id == MARKETPLACE_ID,
                ApplicationRequirement.application_requirement_id.in_(requirement_ids),
            )
        )
    await database.execute(
        delete(ApplicationExistingCreditFacility).where(
            ApplicationExistingCreditFacility.marketplace_id == MARKETPLACE_ID,
            ApplicationExistingCreditFacility.facility_id.in_(facility_ids),
        )
    )
    await database.flush()
    return removable_object_keys


async def _materialize_facility_requirements(
    database: Any, application: LoanApplication, facility: ApplicationExistingCreditFacility
) -> None:
    requirements = (
        await database.scalars(
            select(DocumentRequirement).where(
                DocumentRequirement.marketplace_id == MARKETPLACE_ID,
                DocumentRequirement.checklist_version_id == application.checklist_version_id,
                DocumentRequirement.attaches_to == "facility",
            )
        )
    ).all()
    for requirement in requirements:
        database.add(
            ApplicationRequirement(
                marketplace_id=MARKETPLACE_ID,
                application_id=application.application_id,
                requirement_id=requirement.requirement_id,
                document_type_code=requirement.document_type_code,
                attaches_to="facility",
                facility_id=facility.facility_id,
                obligation=requirement.obligation,
                blocks_submission=requirement.blocks_submission,
                alt_group=requirement.alt_group,
                coverage_mode=requirement.coverage_mode,
                min_count=requirement.min_count,
                status="pending",
                cached_coverage_state={},
            )
        )


async def _link_document_to_requirement(
    database: Any,
    application: LoanApplication,
    document: Document,
    requirement: ApplicationRequirement,
) -> None:
    now = datetime.now(timezone.utc)
    touched: set[uuid.UUID] = set()

    async def _link(target: ApplicationRequirement) -> None:
        exists = await database.scalar(
            select(DocumentRequirementSatisfaction.satisfaction_id).where(
                DocumentRequirementSatisfaction.marketplace_id == MARKETPLACE_ID,
                DocumentRequirementSatisfaction.application_requirement_id
                == target.application_requirement_id,
                DocumentRequirementSatisfaction.document_id == document.document_id,
                DocumentRequirementSatisfaction.unlinked_at.is_(None),
            )
        )
        if exists is None:
            database.add(
                DocumentRequirementSatisfaction(
                    marketplace_id=MARKETPLACE_ID,
                    application_id=application.application_id,
                    application_requirement_id=target.application_requirement_id,
                    document_id=document.document_id,
                    linked_by_type="borrower",
                    linked_at=now,
                )
            )
            database.add(
                DocumentEvent(
                    marketplace_id=MARKETPLACE_ID,
                    document_id=document.document_id,
                    event_type="linked",
                    actor_type="borrower",
                    occurred_at=now,
                    metadata_={
                        "application_requirement_id": str(target.application_requirement_id)
                    },
                )
            )
        touched.add(target.application_requirement_id)

    await _link(requirement)

    party_filter = (
        ApplicationRequirement.application_party_id == requirement.application_party_id
        if requirement.application_party_id is not None
        else ApplicationRequirement.application_party_id.is_(None)
    )
    facility_filter = (
        ApplicationRequirement.facility_id == requirement.facility_id
        if requirement.facility_id is not None
        else ApplicationRequirement.facility_id.is_(None)
    )
    siblings = (
        await database.scalars(
            select(ApplicationRequirement).where(
                ApplicationRequirement.marketplace_id == MARKETPLACE_ID,
                ApplicationRequirement.application_id == application.application_id,
                ApplicationRequirement.document_type_code == requirement.document_type_code,
                ApplicationRequirement.attaches_to == requirement.attaches_to,
                party_filter,
                facility_filter,
                ApplicationRequirement.application_requirement_id
                != requirement.application_requirement_id,
                ApplicationRequirement.status.notin_(_TERMINAL_STATUSES),
            )
        )
    ).all()
    for sibling in siblings:
        await _link(sibling)

    await database.flush()

    for requirement_id in touched:
        await _recompute_and_store_status(database, requirement_id)

    refreshed = await database.get(ApplicationRequirement, requirement.application_requirement_id)
    if refreshed is not None and refreshed.alt_group and refreshed.status == "collected":
        await _satisfy_alt_group(
            database, application.application_id, refreshed.alt_group, refreshed
        )


async def _satisfy_alt_group(
    database: Any,
    application_id: uuid.UUID,
    alt_group: str,
    satisfied: ApplicationRequirement,
) -> None:
    siblings = (
        await database.scalars(
            select(ApplicationRequirement).where(
                ApplicationRequirement.marketplace_id == MARKETPLACE_ID,
                ApplicationRequirement.application_id == application_id,
                ApplicationRequirement.alt_group == alt_group,
                ApplicationRequirement.application_requirement_id
                != satisfied.application_requirement_id,
                ApplicationRequirement.status != "collected",
            )
        )
    ).all()
    now = datetime.now(timezone.utc)
    for sibling in siblings:
        if sibling.status != "not_applicable":
            database.add(
                ApplicationRequirementEvent(
                    marketplace_id=MARKETPLACE_ID,
                    application_requirement_id=sibling.application_requirement_id,
                    event_type="recalculated",
                    from_status=sibling.status,
                    to_status="not_applicable",
                    reason=f"Satisfied by alternative in group '{alt_group}'",
                    actor_type="system",
                    occurred_at=now,
                )
            )
            sibling.status = "not_applicable"
            sibling.updated_at = now


async def _revert_alt_group_if_unsatisfied(
    database: Any, application_id: uuid.UUID, alt_group: str
) -> None:
    members = (
        await database.scalars(
            select(ApplicationRequirement).where(
                ApplicationRequirement.marketplace_id == MARKETPLACE_ID,
                ApplicationRequirement.application_id == application_id,
                ApplicationRequirement.alt_group == alt_group,
            )
        )
    ).all()
    if any(member.status == "collected" for member in members):
        return
    now = datetime.now(timezone.utc)
    for member in members:
        if member.status == "not_applicable":
            database.add(
                ApplicationRequirementEvent(
                    marketplace_id=MARKETPLACE_ID,
                    application_requirement_id=member.application_requirement_id,
                    event_type="recalculated",
                    from_status=member.status,
                    to_status="pending",
                    reason=f"No alternative in group '{alt_group}' remains satisfied",
                    actor_type="system",
                    occurred_at=now,
                )
            )
            member.status = "pending"
            member.updated_at = now


async def _recompute_and_store_status(
    database: Any, application_requirement_id: uuid.UUID
) -> ApplicationRequirement | None:
    requirement = await database.get(ApplicationRequirement, application_requirement_id)
    if requirement is None:
        return None
    live_documents = (
        await database.scalars(
            select(Document)
            .join(
                DocumentRequirementSatisfaction,
                DocumentRequirementSatisfaction.document_id == Document.document_id,
            )
            .where(
                DocumentRequirementSatisfaction.marketplace_id == MARKETPLACE_ID,
                DocumentRequirementSatisfaction.application_requirement_id
                == application_requirement_id,
                DocumentRequirementSatisfaction.unlinked_at.is_(None),
                Document.status == "uploaded",
            )
        )
    ).all()
    new_status = _compute_status(requirement, live_documents)
    if new_status != requirement.status and requirement.status not in _TERMINAL_STATUSES:
        now = datetime.now(timezone.utc)
        database.add(
            ApplicationRequirementEvent(
                marketplace_id=MARKETPLACE_ID,
                application_requirement_id=application_requirement_id,
                event_type="status_change",
                from_status=requirement.status,
                to_status=new_status,
                actor_type="system",
                occurred_at=now,
            )
        )
        requirement.status = new_status
        requirement.updated_at = now
    return requirement


def _compute_status(requirement: ApplicationRequirement, live_documents: list[Document]) -> str:
    count = len(live_documents)
    if count == 0:
        return "pending"
    if requirement.coverage_mode == "fiscal_year":
        years = {
            document.fiscal_year_start or document.coverage_from
            for document in live_documents
            if document.fiscal_year_start or document.coverage_from
        }
        if len(years) >= requirement.min_count:
            return "collected"
        return "partial"
    if requirement.coverage_mode == "month_range":
        intervals = [
            (document.coverage_from, document.coverage_to)
            for document in live_documents
            if document.coverage_from and document.coverage_to
        ]
        if _covers(intervals, requirement.required_period_from, requirement.required_period_to):
            return "collected"
        return "partial"
    if count >= requirement.min_count:
        return "collected"
    return "partial"


def _merge_intervals(intervals: list[tuple[date, date]]) -> list[tuple[date, date]]:
    if not intervals:
        return []
    ordered = sorted(intervals)
    merged = [ordered[0]]
    for start, end in ordered[1:]:
        last_start, last_end = merged[-1]
        if start <= last_end + timedelta(days=1):
            merged[-1] = (last_start, max(last_end, end))
        else:
            merged.append((start, end))
    return merged


def _covers(
    intervals: list[tuple[date, date]], required_from: date | None, required_to: date | None
) -> bool:
    if required_from is None or required_to is None:
        return len(intervals) > 0
    for start, end in _merge_intervals(intervals):
        if start <= required_from and end >= required_to:
            return True
    return False
