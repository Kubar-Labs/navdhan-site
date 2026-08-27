"""Tenant-scoped application retention enforcement.

Run this as a private Cloud Run Job for one explicit marketplace at a time.
The job never bypasses row-level security and defaults to a read-only dry run.
Documents are deleted from GCS before their database metadata is scrubbed; a
storage failure leaves the database row intact so the next run can retry.
"""

from __future__ import annotations

import argparse
import asyncio
import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Sequence
from uuid import UUID

from dateutil.relativedelta import relativedelta
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import close_engine, init_engine, tenant_session
from settings import resolve_database_url
from storage.documents import DocumentStorage
from storage.gcs import GCSStorage

DRAFT_RETENTION_DAYS = 30
SUBMITTED_RETENTION_MONTHS = 60
DEFAULT_BATCH_SIZE = 100
MAX_BATCH_SIZE = 500


@dataclass(frozen=True)
class ApplicationRetentionState:
    status: str
    updated_at: datetime
    submitted_at: datetime | None
    retention_purged_at: datetime | None = None


@dataclass(frozen=True)
class RetentionCandidate:
    application_id: UUID
    status: str
    updated_at: datetime
    submitted_at: datetime | None


def retention_cutoffs(now: datetime) -> tuple[datetime, datetime]:
    if now.tzinfo is None:
        raise ValueError("Retention calculations require a timezone-aware timestamp")
    return (
        now - timedelta(days=DRAFT_RETENTION_DAYS),
        now - relativedelta(months=SUBMITTED_RETENTION_MONTHS),
    )


def is_retention_due(state: ApplicationRetentionState, *, now: datetime) -> bool:
    if state.retention_purged_at is not None:
        return False
    draft_cutoff, submitted_cutoff = retention_cutoffs(now)
    if state.submitted_at is None:
        return state.updated_at <= draft_cutoff
    return state.submitted_at <= submitted_cutoff


async def list_retention_candidates(
    session: AsyncSession,
    *,
    now: datetime,
    limit: int = DEFAULT_BATCH_SIZE,
    lock: bool = False,
) -> list[RetentionCandidate]:
    if not 1 <= limit <= MAX_BATCH_SIZE:
        raise ValueError(f"limit must be between 1 and {MAX_BATCH_SIZE}")
    draft_cutoff, submitted_cutoff = retention_cutoffs(now)
    lock_clause = "FOR UPDATE SKIP LOCKED" if lock else ""
    result = await session.execute(
        text(
            f"""
            SELECT application_id, status::text, updated_at, submitted_at
            FROM loan_applications
            WHERE retention_purged_at IS NULL
              AND (
                (submitted_at IS NULL AND updated_at <= :draft_cutoff)
                OR (submitted_at IS NOT NULL AND submitted_at <= :submitted_cutoff)
              )
            ORDER BY COALESCE(submitted_at, updated_at), application_id
            LIMIT :limit
            {lock_clause}
            """
        ),
        {
            "draft_cutoff": draft_cutoff,
            "submitted_cutoff": submitted_cutoff,
            "limit": limit,
        },
    )
    return [
        RetentionCandidate(
            application_id=row.application_id,
            status=row.status,
            updated_at=row.updated_at,
            submitted_at=row.submitted_at,
        )
        for row in result
    ]


async def _delete_document_objects(
    session: AsyncSession,
    *,
    application_id: UUID,
    storage: DocumentStorage,
) -> list[UUID]:
    result = await session.execute(
        text(
            """
            SELECT document_id, gcs_object, gcs_generation
            FROM documents
            WHERE application_id = :application_id
              AND status <> 'purged'
            ORDER BY document_id
            FOR UPDATE
            """
        ),
        {"application_id": application_id},
    )
    document_ids: list[UUID] = []
    for row in result:
        await asyncio.to_thread(
            storage.delete,
            object_key=row.gcs_object,
            generation=row.gcs_generation,
        )
        document_ids.append(row.document_id)
    return document_ids


async def _scrub_application_rows(
    session: AsyncSession,
    *,
    marketplace_id: UUID,
    application_id: UUID,
    document_ids: Sequence[UUID],
    now: datetime,
) -> None:
    # Sever live requirement satisfaction before the document metadata is
    # marked purged. Historical event rows are retained without free-form PII.
    await session.execute(
        text(
            """
            UPDATE document_requirement_satisfactions
            SET unlinked_at = COALESCE(unlinked_at, :now),
                unlink_reason = 'retention_purge'
            WHERE application_id = :application_id
              AND unlinked_at IS NULL
            """
        ),
        {"application_id": application_id, "now": now},
    )
    await session.execute(
        text(
            """
            UPDATE documents
            SET gcs_object = 'purged/' || document_id::text,
                gcs_generation = NULL,
                sha256 = NULL,
                size_bytes = 0,
                page_count = NULL,
                coverage_from = NULL,
                coverage_to = NULL,
                fiscal_year_start = NULL,
                extracted_data = NULL,
                scan_job_id = NULL,
                scan_completed_at = NULL,
                idempotency_key = 'purged:' || document_id::text,
                uploaded_by_ref = NULL,
                uploaded_at = NULL,
                retention_expires_at = NULL,
                status = 'purged',
                purged_at = :now,
                updated_at = :now
            WHERE application_id = :application_id
            """
        ),
        {"application_id": application_id, "now": now},
    )
    await session.execute(
        text(
            """
            UPDATE application_sessions
            SET revoked_at = COALESCE(revoked_at, :now)
            WHERE application_id = :application_id
            """
        ),
        {"application_id": application_id, "now": now},
    )
    await session.execute(
        text(
            """
            UPDATE application_parties
            SET ownership_pct = NULL,
                updated_at = :now
            WHERE application_id = :application_id
            """
        ),
        {"application_id": application_id, "now": now},
    )
    await session.execute(
        text(
            """
            DELETE FROM application_credit_declarations
            WHERE application_id = :application_id
            """
        ),
        {"application_id": application_id},
    )
    await session.execute(
        text(
            """
            UPDATE application_existing_credit_facilities
            SET lender_name = '[purged]',
                original_loan_amount = NULL,
                outstanding_amount = NULL,
                emi_amount = NULL,
                interest_rate_percent = NULL,
                tenure_months = NULL,
                start_date = NULL,
                end_date = NULL,
                emis_paid_count = NULL,
                total_amount_paid = NULL,
                updated_at = :now
            WHERE application_id = :application_id
            """
        ),
        {"application_id": application_id, "now": now},
    )
    for statement in (
        "UPDATE verification_checks SET provider_ref = NULL, response_json = NULL, response_hash = NULL WHERE application_id = :application_id",
        "UPDATE consent_grants SET artefact_hash = NULL, ip_address = NULL, user_agent = NULL WHERE application_id = :application_id",
        "UPDATE submission_packages SET payload_snapshot = '{}'::jsonb, payload_hash = digest('', 'sha256'), external_ref = NULL, submitted_by_ref = NULL WHERE application_id = :application_id",
        "UPDATE application_status_events SET reason_text = NULL, actor_ref = NULL, metadata = '{}'::jsonb WHERE application_id = :application_id",
        "UPDATE application_requirement_events SET reason = NULL, actor_ref = NULL, metadata = '{}'::jsonb WHERE application_requirement_id IN (SELECT application_requirement_id FROM application_requirements WHERE application_id = :application_id)",
        "UPDATE document_events SET actor_ref = NULL, metadata = '{}'::jsonb WHERE document_id IN (SELECT document_id FROM documents WHERE application_id = :application_id)",
        "UPDATE submission_events SET actor_ref = NULL, metadata = '{}'::jsonb WHERE package_id IN (SELECT package_id FROM submission_packages WHERE application_id = :application_id)",
    ):
        await session.execute(text(statement), {"application_id": application_id})

    # A person or borrower can be shared. Scrub identity data only when every
    # related application has itself reached the retention end state.
    await session.execute(
        text(
            """
            UPDATE person_kyc_verifications AS verification
            SET reference_id = NULL,
                response_hash = NULL
            WHERE verification.person_id IN (
                SELECT party.person_id
                FROM application_parties AS party
                WHERE party.application_id = :application_id
            )
              AND NOT EXISTS (
                SELECT 1
                FROM application_parties AS other_party
                JOIN loan_applications AS other_application
                  ON other_application.marketplace_id = other_party.marketplace_id
                 AND other_application.application_id = other_party.application_id
                WHERE other_party.person_id = verification.person_id
                  AND other_application.application_id <> :application_id
                  AND other_application.retention_purged_at IS NULL
              )
            """
        ),
        {"application_id": application_id},
    )
    await session.execute(
        text(
            """
            UPDATE person_identifiers AS identifier
            SET value_enc = NULL,
                value_hash = NULL,
                masked_value = NULL,
                purged_at = :now,
                updated_at = :now
            WHERE identifier.person_id IN (
                SELECT party.person_id
                FROM application_parties AS party
                WHERE party.application_id = :application_id
            )
              AND NOT EXISTS (
                SELECT 1
                FROM application_parties AS other_party
                JOIN loan_applications AS other_application
                  ON other_application.marketplace_id = other_party.marketplace_id
                 AND other_application.application_id = other_party.application_id
                WHERE other_party.person_id = identifier.person_id
                  AND other_application.application_id <> :application_id
                  AND other_application.retention_purged_at IS NULL
              )
            """
        ),
        {"application_id": application_id, "now": now},
    )
    await session.execute(
        text(
            """
            UPDATE persons AS person
            SET full_name = NULL,
                date_of_birth = NULL,
                gender = NULL,
                mobile_enc = NULL,
                mobile_hash = NULL,
                email_enc = NULL,
                email_hash = NULL,
                address = '{}'::jsonb,
                type_of_residence = NULL,
                employment_status_code = NULL,
                pii_purged_at = :now,
                updated_at = :now
            WHERE person.person_id IN (
                SELECT party.person_id
                FROM application_parties AS party
                WHERE party.application_id = :application_id
            )
              AND NOT EXISTS (
                SELECT 1
                FROM application_parties AS other_party
                JOIN loan_applications AS other_application
                  ON other_application.marketplace_id = other_party.marketplace_id
                 AND other_application.application_id = other_party.application_id
                WHERE other_party.person_id = person.person_id
                  AND other_application.application_id <> :application_id
                  AND other_application.retention_purged_at IS NULL
              )
            """
        ),
        {"application_id": application_id, "now": now},
    )
    await session.execute(
        text(
            """
            UPDATE borrower_registration_verifications AS verification
            SET reference_id = NULL,
                response_hash = NULL
            WHERE verification.registration_id IN (
                SELECT registration.registration_id
                FROM borrower_registrations AS registration
                WHERE registration.borrower_id = (
                    SELECT borrower_id
                    FROM loan_applications
                    WHERE application_id = :application_id
                )
                  AND NOT EXISTS (
                    SELECT 1
                    FROM loan_applications AS other_application
                    WHERE other_application.borrower_id = registration.borrower_id
                      AND other_application.application_id <> :application_id
                      AND other_application.retention_purged_at IS NULL
                  )
            )
            """
        ),
        {"application_id": application_id},
    )
    await session.execute(
        text(
            """
            UPDATE borrower_registrations AS registration
            SET value_enc = NULL,
                masked_value = '[purged]',
                value_hash = digest('purged:' || registration.registration_id::text, 'sha256'),
                state_code = NULL,
                issued_on = NULL,
                valid_till = NULL,
                updated_at = :now
            WHERE registration.borrower_id = (
                SELECT borrower_id FROM loan_applications WHERE application_id = :application_id
            )
              AND NOT EXISTS (
                SELECT 1
                FROM loan_applications AS other_application
                WHERE other_application.borrower_id = registration.borrower_id
                  AND other_application.application_id <> :application_id
                  AND other_application.retention_purged_at IS NULL
              )
            """
        ),
        {"application_id": application_id, "now": now},
    )
    await session.execute(
        text(
            """
            UPDATE borrower_persons AS relationship
            SET ownership_pct = NULL,
                updated_at = :now
            WHERE relationship.borrower_id = (
                SELECT borrower_id FROM loan_applications WHERE application_id = :application_id
            )
              AND NOT EXISTS (
                SELECT 1
                FROM loan_applications AS other_application
                WHERE other_application.borrower_id = relationship.borrower_id
                  AND other_application.application_id <> :application_id
                  AND other_application.retention_purged_at IS NULL
              )
            """
        ),
        {"application_id": application_id, "now": now},
    )
    await session.execute(
        text(
            """
            UPDATE borrowers AS borrower
            SET external_ref = 'purged:' || borrower.borrower_id::text,
                legal_name = NULL,
                trade_name = NULL,
                date_of_incorporation = NULL,
                business_type_code = NULL,
                industry_nic_code = NULL,
                annual_turnover = NULL,
                type_of_office = NULL,
                premises_ownership = NULL,
                location_tier = NULL,
                registered_address = '{}'::jsonb,
                operating_address = '{}'::jsonb,
                attributes = '{}'::jsonb,
                status = 'purged',
                pii_purged_at = :now,
                updated_at = :now
            WHERE borrower.borrower_id = (
                SELECT borrower_id FROM loan_applications WHERE application_id = :application_id
            )
              AND NOT EXISTS (
                SELECT 1
                FROM loan_applications AS other_application
                WHERE other_application.borrower_id = borrower.borrower_id
                  AND other_application.application_id <> :application_id
                  AND other_application.retention_purged_at IS NULL
              )
            """
        ),
        {"application_id": application_id, "now": now},
    )
    await session.execute(
        text(
            """
            UPDATE loan_applications
            SET application_no = 'purged:' || application_id::text,
                requested_amount = NULL,
                approved_amount = NULL,
                requested_tenure_months = NULL,
                income_type_code = NULL,
                purpose = NULL,
                sdk_version = NULL,
                rejection_reason = NULL,
                attributes = jsonb_build_object(
                    'retention_purged', true,
                    'retention_purged_at', CAST(:purged_at_text AS text)
                ),
                status = 'expired',
                retention_purged_at = :now,
                updated_at = :now
            WHERE application_id = :application_id
            """
        ),
        {
            "application_id": application_id,
            "now": now,
            "purged_at_text": now.isoformat(),
        },
    )
    await session.execute(
        text(
            """
            UPDATE audit_events
            SET actor_ref = NULL, before = NULL, after = NULL
            WHERE entity_id = :application_id
               OR entity_id IN (
                    SELECT document_id
                    FROM documents
                    WHERE application_id = :application_id
               )
            """
        ),
        {"application_id": application_id},
    )
    await session.execute(
        text(
            """
            INSERT INTO audit_events (
                audit_id, marketplace_id, entity_type, entity_id, action,
                actor_type, actor_ref, before, after, occurred_at
            ) VALUES (
                gen_random_uuid(), :marketplace_id, 'loan_application',
                :application_id, 'retention_purged', 'system',
                'retention-job', NULL,
                jsonb_build_object(
                    'document_count', CAST(:document_count AS integer)
                ), :now
            )
            """
        ),
        {
            "marketplace_id": marketplace_id,
            "application_id": application_id,
            "document_count": len(document_ids),
            "now": now,
        },
    )


async def purge_retention_candidate(
    *,
    marketplace_id: UUID,
    candidate: RetentionCandidate,
    storage: DocumentStorage,
    now: datetime,
) -> bool:
    async with tenant_session(marketplace_id) as session:
        result = await session.execute(
            text(
                """
                SELECT status::text, updated_at, submitted_at, retention_purged_at
                FROM loan_applications
                WHERE application_id = :application_id
                FOR UPDATE
                """
            ),
            {"application_id": candidate.application_id},
        )
        row = result.one_or_none()
        if row is None or not is_retention_due(
            ApplicationRetentionState(
                status=row.status,
                updated_at=row.updated_at,
                submitted_at=row.submitted_at,
                retention_purged_at=row.retention_purged_at,
            ),
            now=now,
        ):
            return False
        document_ids = await _delete_document_objects(
            session,
            application_id=candidate.application_id,
            storage=storage,
        )
        await _scrub_application_rows(
            session,
            marketplace_id=marketplace_id,
            application_id=candidate.application_id,
            document_ids=document_ids,
            now=now,
        )
        return True


async def run_retention_job(
    *,
    marketplace_id: UUID,
    execute: bool,
    limit: int,
    now: datetime | None = None,
    storage: DocumentStorage | None = None,
) -> dict[str, object]:
    current_time = now or datetime.now(timezone.utc)
    async with tenant_session(marketplace_id) as session:
        candidates = await list_retention_candidates(
            session,
            now=current_time,
            limit=limit,
        )
    if not execute:
        return {
            "mode": "dry-run",
            "marketplace_id": str(marketplace_id),
            "candidate_count": len(candidates),
            "candidate_ids": [str(item.application_id) for item in candidates],
        }
    document_storage = storage or GCSStorage()
    purged = 0
    for candidate in candidates:
        if await purge_retention_candidate(
            marketplace_id=marketplace_id,
            candidate=candidate,
            storage=document_storage,
            now=current_time,
        ):
            purged += 1
    return {
        "mode": "execute",
        "marketplace_id": str(marketplace_id),
        "candidate_count": len(candidates),
        "purged_count": purged,
    }


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--marketplace-id", required=True, type=UUID)
    parser.add_argument("--limit", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Purge eligible records. Without this flag the job is read-only.",
    )
    return parser.parse_args()


async def _main() -> None:
    args = _parse_args()
    init_engine(resolve_database_url())
    try:
        result = await run_retention_job(
            marketplace_id=args.marketplace_id,
            execute=args.execute,
            limit=args.limit,
        )
        print(json.dumps(result, sort_keys=True))
    finally:
        await close_engine()


if __name__ == "__main__":
    asyncio.run(_main())
