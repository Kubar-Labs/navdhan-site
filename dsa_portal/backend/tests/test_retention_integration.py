from __future__ import annotations

import json
import unittest
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import asyncpg

from db.session import close_engine, init_engine
from maintenance.retention import run_retention_job
from tests.db_test_support import (
    TEST_DATABASE_URL,
    TEST_PG_DSN,
    ensure_test_schema,
    guard_live_connection_is_test_database,
)

MARKETPLACE_ID = UUID("10000000-0000-0000-0000-000000000001")


class RecordingStorage:
    def __init__(self) -> None:
        self.deleted: list[tuple[str, int | None]] = []

    def delete(self, *, object_key: str, generation: int | None = None) -> None:
        self.deleted.append((object_key, generation))


async def _clear() -> None:
    connection = await asyncpg.connect(TEST_PG_DSN)
    try:
        await guard_live_connection_is_test_database(connection)
        async with connection.transaction():
            for table in (
                "audit_events",
                "document_requirement_satisfactions",
                "application_requirement_events",
                "document_events",
                "documents",
                "application_requirements",
                "application_credit_declarations",
                "application_existing_credit_facilities",
                "application_status_events",
                "verification_checks",
                "consent_grants",
                "submission_events",
                "submission_packages",
                "person_identifiers",
                "person_kyc_verifications",
                "borrower_registration_verifications",
                "borrower_registrations",
                "application_parties",
                "application_sessions",
                "borrower_persons",
                "loan_applications",
                "persons",
                "borrowers",
            ):
                await connection.execute(f"DELETE FROM {table}")
    finally:
        await connection.close()


async def _insert_expired_draft() -> tuple[UUID, UUID]:
    borrower_id = uuid4()
    application_id = uuid4()
    application_requirement_id = uuid4()
    document_id = uuid4()
    connection = await asyncpg.connect(TEST_PG_DSN)
    try:
        async with connection.transaction():
            checklist_id = await connection.fetchval(
                """
                SELECT checklist_version_id
                FROM checklist_versions
                WHERE marketplace_id = $1
                  AND product_code = 'business_loan'
                  AND constitution = 'partnership'
                  AND status = 'active'
                """,
                MARKETPLACE_ID,
            )
            await connection.execute(
                """
                INSERT INTO borrowers (
                    borrower_id, marketplace_id, external_ref, constitution,
                    legal_name, registered_address, operating_address, attributes
                ) VALUES ($1, $2, $3, 'partnership', 'Sensitive Trading Co',
                          '{"pin":"700001"}', '{}', '{}')
                """,
                borrower_id,
                MARKETPLACE_ID,
                f"retention-{borrower_id}",
            )
            await connection.execute(
                """
                INSERT INTO loan_applications (
                    application_id, marketplace_id, borrower_id, application_no,
                    product_code, constitution, checklist_version_id, channel,
                    requested_amount, purpose, updated_at
                ) VALUES ($1, $2, $3, $4, 'business_loan', 'partnership',
                          $5, 'webapp', 500000, 'working_capital', $6)
                """,
                application_id,
                MARKETPLACE_ID,
                borrower_id,
                f"ND-{application_id}",
                checklist_id,
                datetime.now(timezone.utc) - timedelta(days=31),
            )
            await connection.execute(
                """
                INSERT INTO application_requirements (
                    application_requirement_id, marketplace_id, application_id,
                    requirement_id, document_type_code, attaches_to, obligation,
                    blocks_submission, alt_group, coverage_mode, min_count
                )
                SELECT $1, $2, $3, requirement_id, document_type_code,
                       attaches_to, obligation, blocks_submission, alt_group,
                       coverage_mode, min_count
                FROM document_requirements
                WHERE marketplace_id = $2
                  AND checklist_version_id = $4
                  AND document_type_code = 'entity_pan_card'
                  AND attaches_to = 'entity'
                """,
                application_requirement_id,
                MARKETPLACE_ID,
                application_id,
                checklist_id,
            )
            await connection.execute(
                """
                INSERT INTO documents (
                    document_id, marketplace_id, application_id,
                    document_type_code, attaches_to, borrower_id,
                    gcs_bucket, gcs_object, gcs_generation, sha256, mime_type,
                    size_bytes, status, scan_result, uploaded_for_requirement_id,
                    scan_job_id, scan_completed_at, idempotency_key,
                    uploaded_by_type, uploaded_by_ref, extracted_data
                ) VALUES (
                    $1, $2, $3, 'entity_pan_card', 'entity', $4,
                    'navdhan-documents-test', $5, 42, decode('abcd', 'hex'),
                    'application/pdf', 128, 'uploaded', 'clean', $6,
                    $7, now(), $8, 'borrower', 'sensitive-reference',
                    '{"pan":"ABCDE1234F"}'
                )
                """,
                document_id,
                MARKETPLACE_ID,
                application_id,
                borrower_id,
                f"clean/{MARKETPLACE_ID}/{application_id}/{document_id}.pdf",
                application_requirement_id,
                f"retention-scan-{document_id}",
                f"retention-doc-{document_id}",
            )
    finally:
        await connection.close()
    return application_id, document_id


class RetentionIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        await ensure_test_schema()
        await _clear()
        init_engine(TEST_DATABASE_URL, pool_size=2, max_overflow=0)

    async def asyncTearDown(self) -> None:
        await close_engine()
        await _clear()

    async def test_dry_run_is_read_only_and_execute_deletes_then_scrubs(self) -> None:
        application_id, document_id = await _insert_expired_draft()
        storage = RecordingStorage()

        dry_run = await run_retention_job(
            marketplace_id=MARKETPLACE_ID,
            execute=False,
            limit=10,
            storage=storage,
        )
        self.assertEqual("dry-run", dry_run["mode"])
        self.assertIn(str(application_id), dry_run["candidate_ids"])
        self.assertEqual([], storage.deleted)

        result = await run_retention_job(
            marketplace_id=MARKETPLACE_ID,
            execute=True,
            limit=10,
            storage=storage,
        )
        self.assertEqual(1, result["purged_count"])
        self.assertEqual(1, len(storage.deleted))
        self.assertIn(str(document_id), storage.deleted[0][0])
        self.assertEqual(42, storage.deleted[0][1])

        async def verify() -> tuple[asyncpg.Record, asyncpg.Record, int]:
            connection = await asyncpg.connect(TEST_PG_DSN)
            try:
                application = await connection.fetchrow(
                    """
                    SELECT application_no, requested_amount, purpose,
                           retention_purged_at, attributes
                    FROM loan_applications WHERE application_id = $1
                    """,
                    application_id,
                )
                document = await connection.fetchrow(
                    """
                    SELECT status, gcs_object, gcs_generation, sha256,
                           size_bytes, extracted_data, uploaded_by_ref, purged_at
                    FROM documents WHERE document_id = $1
                    """,
                    document_id,
                )
                audit_count = await connection.fetchval(
                    """
                    SELECT count(*) FROM audit_events
                    WHERE entity_id = $1 AND action = 'retention_purged'
                    """,
                    application_id,
                )
                return application, document, audit_count
            finally:
                await connection.close()

        application, document, audit_count = await verify()
        self.assertTrue(application["application_no"].startswith("purged:"))
        self.assertIsNone(application["requested_amount"])
        self.assertIsNone(application["purpose"])
        self.assertIsNotNone(application["retention_purged_at"])
        attributes = application["attributes"]
        if isinstance(attributes, str):
            attributes = json.loads(attributes)
        self.assertTrue(attributes["retention_purged"])
        self.assertEqual("purged", document["status"])
        self.assertEqual(f"purged/{document_id}", document["gcs_object"])
        self.assertIsNone(document["gcs_generation"])
        self.assertIsNone(document["sha256"])
        self.assertEqual(0, document["size_bytes"])
        self.assertIsNone(document["extracted_data"])
        self.assertIsNone(document["uploaded_by_ref"])
        self.assertIsNotNone(document["purged_at"])
        self.assertEqual(1, audit_count)


if __name__ == "__main__":
    unittest.main()
