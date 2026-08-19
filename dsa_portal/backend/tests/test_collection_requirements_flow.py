from __future__ import annotations

import asyncio
import base64
import os
import secrets
import unittest
import uuid
from contextlib import asynccontextmanager
from datetime import date, timedelta
from unittest import mock

import asyncpg
from fastapi.testclient import TestClient

from collection_app import build_collection_app
from services import collection_requirements
from storage.gcs import GCSStorage
from tests.gcs_test_support import FakeGCSClient
from tests.db_test_support import (
    TEST_DATABASE_URL,
    TEST_PG_DSN as PG_DSN,
    ensure_test_schema,
    guard_live_connection_is_test_database,
)


SESSION_HEADER = "x-navdhan-session-digest"
SERVICE_HEADER = "x-navdhan-service-token"
SERVICE_TOKEN = "test-backend-service-token-32-bytes-minimum"
SCAN_HEADER = "x-navdhan-scan-token"
SCAN_TOKEN = "test-document-scan-callback-token-32-bytes"
TEST_BUCKET = "navdhan-documents-test"
MINIMAL_PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"


class ScannedUploadResponse:
    """Keep the upload's 201 status while exposing the post-scan snapshot."""

    def __init__(self, upload_response: object, snapshot_response: object) -> None:
        self.status_code = upload_response.status_code
        self.text = snapshot_response.text
        self._snapshot_response = snapshot_response

    def json(self) -> dict:
        return self._snapshot_response.json()


async def _execute(statement: str, *arguments: object) -> str:
    connection = await asyncpg.connect(PG_DSN)
    try:
        return await connection.execute(statement, *arguments)
    finally:
        await connection.close()


async def _fetch(statement: str, *arguments: object) -> list[asyncpg.Record]:
    connection = await asyncpg.connect(PG_DSN)
    try:
        return list(await connection.fetch(statement, *arguments))
    finally:
        await connection.close()


async def _clear_transaction_rows() -> None:
    connection = await asyncpg.connect(PG_DSN)
    try:
        await guard_live_connection_is_test_database(connection)
        async with connection.transaction():
            for table in (
                "document_requirement_satisfactions",
                "application_requirement_events",
                "document_events",
                "documents",
                "application_requirements",
                "application_credit_declarations",
                "application_existing_credit_facilities",
                "application_status_events",
                "person_identifiers",
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


class CollectionRequirementsFlowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls._previous_encryption_key = os.environ.get("ENCRYPTION_KEY")
        cls._previous_lookup_key = os.environ.get("LOOKUP_HMAC_KEY")
        cls._previous_service_token = os.environ.get("APPLY_SERVICE_TOKEN")
        cls._previous_scan_token = os.environ.get("DOCUMENT_SCAN_CALLBACK_TOKEN")
        os.environ["ENCRYPTION_KEY"] = base64.b64encode(
            secrets.token_bytes(32)
        ).decode()
        os.environ["LOOKUP_HMAC_KEY"] = base64.b64encode(
            secrets.token_bytes(32)
        ).decode()
        os.environ["APPLY_SERVICE_TOKEN"] = SERVICE_TOKEN
        os.environ["DOCUMENT_SCAN_CALLBACK_TOKEN"] = SCAN_TOKEN
        from security import crypto

        crypto._cached_key = None

        # Documents go to GCS now, so point the service's storage at an
        # in-memory bucket instead of real credentials and a real bucket.
        cls.gcs_client = FakeGCSClient()
        cls._previous_storage = collection_requirements._STORAGE
        collection_requirements._STORAGE = GCSStorage(
            bucket_name=TEST_BUCKET, client=cls.gcs_client
        )
        asyncio.run(ensure_test_schema())
        asyncio.run(_clear_transaction_rows())
        cls.app = build_collection_app(database_url=TEST_DATABASE_URL)
        cls.client_context = TestClient(
            cls.app,
            headers={SERVICE_HEADER: SERVICE_TOKEN},
        )
        cls.client = cls.client_context.__enter__()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.client_context.__exit__(None, None, None)
        asyncio.run(_clear_transaction_rows())
        for name, prior in (
            ("ENCRYPTION_KEY", cls._previous_encryption_key),
            ("LOOKUP_HMAC_KEY", cls._previous_lookup_key),
            ("APPLY_SERVICE_TOKEN", cls._previous_service_token),
            ("DOCUMENT_SCAN_CALLBACK_TOKEN", cls._previous_scan_token),
        ):
            if prior is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = prior
        collection_requirements._STORAGE = cls._previous_storage
        from security import crypto

        crypto._cached_key = None

    def setUp(self) -> None:
        asyncio.run(_clear_transaction_rows())

    # -- helpers ---------------------------------------------------------

    def _create_session(self) -> str:
        digest = secrets.token_hex(32)
        response = self.client.post("/api/apply/session", json={"token_digest": digest})
        self.assertEqual(201, response.status_code, response.text)
        return digest

    def _start_application(
        self, digest: str, constitution: str = "proprietorship"
    ) -> dict:
        response = self.client.put(
            "/api/apply/applications/current/loan-intent",
            headers={SESSION_HEADER: digest},
            json={
                "constitution": constitution,
                "requested_amount": 500_000,
                "requested_tenure_months": 3,
                "purpose": "working_capital",
                "expected_lock_version": 0,
            },
        )
        self.assertEqual(200, response.status_code, response.text)
        return response.json()

    def _requirements(self, digest: str) -> dict:
        response = self.client.get(
            "/api/apply/applications/current/requirements",
            headers={SESSION_HEADER: digest},
        )
        self.assertEqual(200, response.status_code, response.text)
        return response.json()

    def _find_requirement(
        self, requirements: dict, document_type_code: str, **scope: object
    ) -> dict:
        for row in requirements["requirements"]:
            if row["document_type_code"] != document_type_code:
                continue
            if all(row.get(key) == value for key, value in scope.items()):
                return row
        raise AssertionError(f"requirement not found: {document_type_code} {scope}")

    def _facility_payload(self, **overrides: object) -> dict:
        payload = {
            "facility_type": "business",
            "lender_name": "Test Bank",
            "original_loan_amount": 200000,
            "outstanding_amount": 100000,
            "emi_amount": 5000,
            "interest_rate_percent": 11.5,
            "tenure_months": 36,
            "start_date": "2024-01-01",
            "end_date": "2027-01-01",
            "emis_paid_count": 12,
        }
        payload.update(overrides)
        return payload

    def _upload(
        self,
        digest: str,
        *,
        requirement_id: str,
        lock_version: int,
        coverage_from: str | None = None,
        coverage_to: str | None = None,
        supersedes_document_id: str | None = None,
        content: bytes = MINIMAL_PDF,
        content_type: str = "application/pdf",
        filename: str = "doc.pdf",
        scan: bool = True,
    ):
        data = {
            "application_requirement_id": requirement_id,
            "expected_lock_version": str(lock_version),
        }
        if coverage_from is not None:
            data["coverage_from"] = coverage_from
        if coverage_to is not None:
            data["coverage_to"] = coverage_to
        if supersedes_document_id is not None:
            data["supersedes_document_id"] = supersedes_document_id
        response = self.client.post(
            "/api/apply/applications/current/documents",
            headers={SESSION_HEADER: digest},
            data=data,
            files={"file": (filename, content, content_type)},
        )
        if response.status_code != 201 or not scan:
            return response

        rows = asyncio.run(
            _fetch(
                """
                SELECT document_id, gcs_generation, encode(sha256, 'hex') AS sha256
                FROM documents
                WHERE uploaded_for_requirement_id = $1
                  AND status = 'quarantined'
                ORDER BY uploaded_at DESC
                LIMIT 1
                """,
                uuid.UUID(requirement_id),
            )
        )
        self.assertEqual(
            1, len(rows), "new upload must remain quarantined before scanning"
        )
        scan_response = self._scan_document(rows[0])
        self.assertEqual(200, scan_response.status_code, scan_response.text)
        refreshed = self.client.get(
            "/api/apply/applications/current/requirements",
            headers={SESSION_HEADER: digest},
        )
        self.assertEqual(200, refreshed.status_code, refreshed.text)
        return ScannedUploadResponse(response, refreshed)

    def _scan_document(
        self,
        document: asyncpg.Record,
        *,
        scan_result: str = "clean",
        scanner_job_id: str | None = None,
        gcs_generation: int | None = None,
        sha256: str | None = None,
    ):
        return self.client.post(
            f"/internal/document-scans/{document['document_id']}/result",
            headers={SCAN_HEADER: SCAN_TOKEN},
            json={
                "scan_result": scan_result,
                "gcs_generation": gcs_generation or document["gcs_generation"],
                "sha256": sha256 or document["sha256"],
                "scanner_job_id": scanner_job_id or f"test-scan-{uuid.uuid4()}",
            },
        )

    def _pending_document(self, requirement_id: str) -> asyncpg.Record:
        rows = asyncio.run(
            _fetch(
                """
                SELECT document_id, gcs_object, gcs_generation,
                       encode(sha256, 'hex') AS sha256
                FROM documents
                WHERE uploaded_for_requirement_id = $1
                  AND status = 'quarantined'
                ORDER BY uploaded_at DESC
                LIMIT 1
                """,
                uuid.UUID(requirement_id),
            )
        )
        self.assertEqual(1, len(rows))
        return rows[0]

    # -- requirements listing --------------------------------------------

    def test_requirements_are_materialized_per_constitution_at_init(self) -> None:
        expected_counts = {
            "proprietorship": 9,
            "partnership": 10,
            "private_limited": 10,
        }
        for constitution, expected_count in expected_counts.items():
            with self.subTest(constitution=constitution):
                asyncio.run(_clear_transaction_rows())
                digest = self._create_session()
                self._start_application(digest, constitution)
                requirements = self._requirements(digest)
                self.assertEqual(expected_count, len(requirements["requirements"]))
                self.assertTrue(
                    all(
                        row["status"] == "pending"
                        for row in requirements["requirements"]
                    )
                )
                self.assertEqual(0, len(requirements["facilities"]))
                self.assertIsNone(
                    requirements["credit_declaration"]["has_active_credit_facilities"]
                )

    def test_requirements_reject_missing_or_foreign_session(self) -> None:
        missing = self.client.get("/api/apply/applications/current/requirements")
        self.assertEqual(401, missing.status_code)

        unknown = self.client.get(
            "/api/apply/applications/current/requirements",
            headers={SESSION_HEADER: secrets.token_hex(32)},
        )
        self.assertEqual(401, unknown.status_code)

    # -- document upload: happy path -------------------------------------

    def test_upload_stays_pending_until_an_authenticated_clean_scan(self) -> None:
        digest = self._create_session()
        started = self._start_application(digest)
        pan_requirement = self._find_requirement(
            self._requirements(digest), "pan_card", attaches_to="person"
        )

        response = self._upload(
            digest,
            requirement_id=pan_requirement["application_requirement_id"],
            lock_version=started["lock_version"],
            scan=False,
        )
        self.assertEqual(201, response.status_code, response.text)
        pending = self._find_requirement(
            response.json(), "pan_card", attaches_to="person"
        )
        self.assertEqual("pending", pending["status"])
        self.assertEqual("quarantined", pending["documents"][0]["status"])
        self.assertEqual("pending", pending["documents"][0]["scan_result"])

        document = self._pending_document(pan_requirement["application_requirement_id"])
        self.assertTrue(document["gcs_object"].startswith("quarantine/"))
        scanned = self._scan_document(document, scanner_job_id="pending-clean-job")
        self.assertEqual(200, scanned.status_code, scanned.text)

        collected = self._find_requirement(
            self._requirements(digest), "pan_card", attaches_to="person"
        )
        self.assertEqual("collected", collected["status"])
        self.assertEqual("uploaded", collected["documents"][0]["status"])
        self.assertEqual("clean", collected["documents"][0]["scan_result"])

    def test_scan_rejects_stale_generation_wrong_hash_and_conflicting_replay(
        self,
    ) -> None:
        digest = self._create_session()
        started = self._start_application(digest)
        pan_requirement = self._find_requirement(
            self._requirements(digest), "pan_card", attaches_to="person"
        )
        uploaded = self._upload(
            digest,
            requirement_id=pan_requirement["application_requirement_id"],
            lock_version=started["lock_version"],
            scan=False,
        )
        self.assertEqual(201, uploaded.status_code, uploaded.text)
        document = self._pending_document(pan_requirement["application_requirement_id"])

        stale = self._scan_document(
            document,
            scanner_job_id="stale-generation-job",
            gcs_generation=document["gcs_generation"] + 1,
        )
        self.assertEqual(422, stale.status_code, stale.text)
        wrong_hash = self._scan_document(
            document,
            scanner_job_id="wrong-hash-job",
            sha256="0" * 64,
        )
        self.assertEqual(422, wrong_hash.status_code, wrong_hash.text)

        clean = self._scan_document(document, scanner_job_id="successful-clean-job")
        self.assertEqual(200, clean.status_code, clean.text)
        replay = self._scan_document(document, scanner_job_id="successful-clean-job")
        self.assertEqual(200, replay.status_code, replay.text)
        conflicting = self._scan_document(
            document,
            scan_result="infected",
            scanner_job_id="different-conflicting-job",
        )
        self.assertEqual(409, conflicting.status_code, conflicting.text)

    def test_failed_scan_is_visible_but_does_not_satisfy_the_requirement(self) -> None:
        digest = self._create_session()
        started = self._start_application(digest)
        pan_requirement = self._find_requirement(
            self._requirements(digest), "pan_card", attaches_to="person"
        )
        uploaded = self._upload(
            digest,
            requirement_id=pan_requirement["application_requirement_id"],
            lock_version=started["lock_version"],
            scan=False,
        )
        self.assertEqual(201, uploaded.status_code, uploaded.text)
        document = self._pending_document(pan_requirement["application_requirement_id"])

        failed = self._scan_document(
            document,
            scan_result="infected",
            scanner_job_id="infected-document-job",
        )
        self.assertEqual(200, failed.status_code, failed.text)
        requirement = self._find_requirement(
            self._requirements(digest), "pan_card", attaches_to="person"
        )
        self.assertEqual("pending", requirement["status"])
        self.assertEqual("scan_failed", requirement["documents"][0]["status"])
        self.assertEqual("infected", requirement["documents"][0]["scan_result"])
        self.assertNotIn(document["gcs_object"], self._stored_objects())

    def test_uploading_a_document_marks_requirement_collected(self) -> None:
        digest = self._create_session()
        started = self._start_application(digest)
        requirements = self._requirements(digest)
        pan_requirement = self._find_requirement(
            requirements, "pan_card", attaches_to="person"
        )

        response = self._upload(
            digest,
            requirement_id=pan_requirement["application_requirement_id"],
            lock_version=started["lock_version"],
        )
        self.assertEqual(201, response.status_code, response.text)
        body = response.json()
        updated = self._find_requirement(body, "pan_card", attaches_to="person")
        self.assertEqual("collected", updated["status"])
        self.assertEqual(1, len(updated["documents"]))
        self.assertEqual(1, body["lock_version"])

    def test_upload_rejects_invalid_pdf_signature(self) -> None:
        digest = self._create_session()
        started = self._start_application(digest)
        requirements = self._requirements(digest)
        pan_requirement = self._find_requirement(
            requirements, "pan_card", attaches_to="person"
        )

        response = self._upload(
            digest,
            requirement_id=pan_requirement["application_requirement_id"],
            lock_version=started["lock_version"],
            content=b"not a pdf at all",
        )
        self.assertEqual(422, response.status_code, response.text)

        unchanged = self._requirements(digest)
        self.assertEqual(
            "pending",
            self._find_requirement(unchanged, "pan_card", attaches_to="person")[
                "status"
            ],
        )

    def test_upload_rejects_documents_larger_than_the_type_limit(self) -> None:
        digest = self._create_session()
        started = self._start_application(digest)
        requirements = self._requirements(digest)
        pan_requirement = self._find_requirement(
            requirements, "pan_card", attaches_to="person"
        )

        oversized = MINIMAL_PDF + b"0" * (10 * 1024 * 1024)
        response = self._upload(
            digest,
            requirement_id=pan_requirement["application_requirement_id"],
            lock_version=started["lock_version"],
            content=oversized,
        )
        self.assertEqual(422, response.status_code, response.text)

    def test_upload_rejects_empty_file(self) -> None:
        digest = self._create_session()
        started = self._start_application(digest)
        requirements = self._requirements(digest)
        pan_requirement = self._find_requirement(
            requirements, "pan_card", attaches_to="person"
        )

        response = self._upload(
            digest,
            requirement_id=pan_requirement["application_requirement_id"],
            lock_version=started["lock_version"],
            content=b"",
        )
        self.assertEqual(422, response.status_code, response.text)

    def test_upload_rejects_wrong_filename_extension(self) -> None:
        digest = self._create_session()
        started = self._start_application(digest)
        requirements = self._requirements(digest)
        pan_requirement = self._find_requirement(
            requirements, "pan_card", attaches_to="person"
        )

        response = self._upload(
            digest,
            requirement_id=pan_requirement["application_requirement_id"],
            lock_version=started["lock_version"],
            filename="pan.txt",
        )
        self.assertEqual(422, response.status_code, response.text)

        unchanged = self._requirements(digest)
        self.assertEqual(
            "pending",
            self._find_requirement(unchanged, "pan_card", attaches_to="person")[
                "status"
            ],
        )

    def test_upload_rejects_a_truncated_pdf_with_no_trailer(self) -> None:
        digest = self._create_session()
        started = self._start_application(digest)
        requirements = self._requirements(digest)
        pan_requirement = self._find_requirement(
            requirements, "pan_card", attaches_to="person"
        )

        response = self._upload(
            digest,
            requirement_id=pan_requirement["application_requirement_id"],
            lock_version=started["lock_version"],
            content=b"%PDF-1.4\n1 0 obj<<>>endobj\n",
        )
        self.assertEqual(422, response.status_code, response.text)

    def test_upload_rejects_stale_lock_version(self) -> None:
        digest = self._create_session()
        started = self._start_application(digest)
        requirements = self._requirements(digest)
        pan_requirement = self._find_requirement(
            requirements, "pan_card", attaches_to="person"
        )

        response = self._upload(
            digest,
            requirement_id=pan_requirement["application_requirement_id"],
            lock_version=started["lock_version"] + 5,
        )
        self.assertEqual(409, response.status_code, response.text)

    def test_upload_rejects_unknown_requirement(self) -> None:
        digest = self._create_session()
        started = self._start_application(digest)

        response = self._upload(
            digest,
            requirement_id="00000000-0000-0000-0000-000000000000",
            lock_version=started["lock_version"],
        )
        self.assertEqual(404, response.status_code, response.text)

    # -- alt_group vintage proof -------------------------------------------

    def test_alt_group_vintage_proof_any_one_satisfies_and_marks_others_not_applicable(
        self,
    ) -> None:
        digest = self._create_session()
        started = self._start_application(digest)
        requirements = self._requirements(digest)
        gst_certificate = self._find_requirement(
            requirements, "gst_certificate", attaches_to="entity"
        )

        response = self._upload(
            digest,
            requirement_id=gst_certificate["application_requirement_id"],
            lock_version=started["lock_version"],
        )
        self.assertEqual(201, response.status_code, response.text)
        body = response.json()
        self.assertEqual(
            "collected",
            self._find_requirement(body, "gst_certificate", attaches_to="entity")[
                "status"
            ],
        )
        self.assertEqual(
            "not_applicable",
            self._find_requirement(body, "vat_proof", attaches_to="entity")["status"],
        )
        self.assertEqual(
            "not_applicable",
            self._find_requirement(body, "trade_license", attaches_to="entity")[
                "status"
            ],
        )

    def test_deleting_the_alt_group_document_reverts_siblings_to_pending(self) -> None:
        digest = self._create_session()
        started = self._start_application(digest)
        requirements = self._requirements(digest)
        gst_certificate = self._find_requirement(
            requirements, "gst_certificate", attaches_to="entity"
        )

        uploaded = self._upload(
            digest,
            requirement_id=gst_certificate["application_requirement_id"],
            lock_version=started["lock_version"],
        ).json()
        document_id = self._find_requirement(
            uploaded, "gst_certificate", attaches_to="entity"
        )["documents"][0]["document_id"]

        response = self.client.request(
            "DELETE",
            f"/api/apply/applications/current/documents/{document_id}",
            headers={SESSION_HEADER: digest},
            params={"expected_lock_version": uploaded["lock_version"]},
        )
        self.assertEqual(200, response.status_code, response.text)
        body = response.json()
        self.assertEqual(
            "pending",
            self._find_requirement(body, "gst_certificate", attaches_to="entity")[
                "status"
            ],
        )
        self.assertEqual(
            "pending",
            self._find_requirement(body, "vat_proof", attaches_to="entity")["status"],
        )

    # -- two-year financials (fiscal_year coverage) -------------------------

    def test_two_year_financials_need_two_distinct_fiscal_year_documents(self) -> None:
        digest = self._create_session()
        started = self._start_application(digest)
        requirements = self._requirements(digest)
        itr = self._find_requirement(requirements, "itr", attaches_to="entity")
        self.assertEqual(2, itr["min_count"])
        self.assertEqual("fiscal_year", itr["coverage_mode"])
        first_year = date.fromisoformat(itr["required_period_from"])
        second_year = date(first_year.year + 1, first_year.month, first_year.day)

        first = self._upload(
            digest,
            requirement_id=itr["application_requirement_id"],
            lock_version=started["lock_version"],
            coverage_from=first_year.isoformat(),
            coverage_to=date(first_year.year + 1, 3, 31).isoformat(),
        )
        self.assertEqual(201, first.status_code, first.text)
        after_first = self._find_requirement(first.json(), "itr", attaches_to="entity")
        self.assertEqual("partial", after_first["status"])

        second = self._upload(
            digest,
            requirement_id=itr["application_requirement_id"],
            lock_version=first.json()["lock_version"],
            coverage_from=second_year.isoformat(),
            coverage_to=date(second_year.year + 1, 3, 31).isoformat(),
        )
        self.assertEqual(201, second.status_code, second.text)
        after_second = self._find_requirement(
            second.json(), "itr", attaches_to="entity"
        )
        self.assertEqual("collected", after_second["status"])
        self.assertEqual(2, len(after_second["documents"]))

    def test_out_of_window_fiscal_years_do_not_satisfy_the_pinned_requirement(
        self,
    ) -> None:
        digest = self._create_session()
        started = self._start_application(digest)
        itr = self._find_requirement(
            self._requirements(digest), "itr", attaches_to="entity"
        )
        required_start = date.fromisoformat(itr["required_period_from"])
        old_years = (
            date(required_start.year - 2, 4, 1),
            date(required_start.year - 1, 4, 1),
        )

        lock_version = started["lock_version"]
        for fiscal_start in old_years:
            response = self._upload(
                digest,
                requirement_id=itr["application_requirement_id"],
                lock_version=lock_version,
                coverage_from=fiscal_start.isoformat(),
                coverage_to=date(fiscal_start.year + 1, 3, 31).isoformat(),
            )
            self.assertEqual(201, response.status_code, response.text)
            lock_version = response.json()["lock_version"]

        updated = self._find_requirement(response.json(), "itr", attaches_to="entity")
        self.assertEqual("partial", updated["status"])

    def test_partial_fiscal_year_metadata_is_rejected(self) -> None:
        digest = self._create_session()
        started = self._start_application(digest)
        itr = self._find_requirement(
            self._requirements(digest), "itr", attaches_to="entity"
        )
        required_start = date.fromisoformat(itr["required_period_from"])

        response = self._upload(
            digest,
            requirement_id=itr["application_requirement_id"],
            lock_version=started["lock_version"],
            coverage_from=required_start.isoformat(),
            coverage_to=date(required_start.year, 12, 31).isoformat(),
        )

        self.assertEqual(422, response.status_code, response.text)

    # -- 12-month bank statement coverage ------------------------------------

    def test_consolidated_bank_statement_covering_the_full_window_is_collected(
        self,
    ) -> None:
        digest = self._create_session()
        started = self._start_application(digest)
        requirements = self._requirements(digest)
        bank_statement = self._find_requirement(
            requirements, "bank_statement", attaches_to="entity"
        )
        required_from = bank_statement["required_period_from"]
        required_to = bank_statement["required_period_to"]

        response = self._upload(
            digest,
            requirement_id=bank_statement["application_requirement_id"],
            lock_version=started["lock_version"],
            coverage_from=required_from,
            coverage_to=required_to,
        )
        self.assertEqual(201, response.status_code, response.text)
        updated = self._find_requirement(
            response.json(), "bank_statement", attaches_to="entity"
        )
        self.assertEqual("collected", updated["status"])

    def test_partial_monthly_bank_statements_leave_a_gap_as_partial(self) -> None:
        digest = self._create_session()
        started = self._start_application(digest)
        requirements = self._requirements(digest)
        bank_statement = self._find_requirement(
            requirements, "bank_statement", attaches_to="entity"
        )
        required_from = date.fromisoformat(bank_statement["required_period_from"])

        response = self._upload(
            digest,
            requirement_id=bank_statement["application_requirement_id"],
            lock_version=started["lock_version"],
            coverage_from=required_from.isoformat(),
            coverage_to=(required_from + timedelta(days=27)).isoformat(),
        )
        self.assertEqual(201, response.status_code, response.text)
        updated = self._find_requirement(
            response.json(), "bank_statement", attaches_to="entity"
        )
        self.assertEqual("partial", updated["status"])

    def test_multiple_contiguous_monthly_documents_merge_into_a_collected_range(
        self,
    ) -> None:
        digest = self._create_session()
        started = self._start_application(digest)
        requirements = self._requirements(digest)
        bank_statement = self._find_requirement(
            requirements, "bank_statement", attaches_to="entity"
        )
        required_from = date.fromisoformat(bank_statement["required_period_from"])
        required_to = date.fromisoformat(bank_statement["required_period_to"])
        total_days = (required_to - required_from).days
        third = total_days // 3

        chunk1_end = required_from + timedelta(days=third)
        chunk2_start = chunk1_end + timedelta(days=1)
        chunk2_end = chunk2_start + timedelta(days=third)
        chunk3_start = chunk2_end + timedelta(days=1)

        lock_version = started["lock_version"]
        for chunk_from, chunk_to in (
            (required_from, chunk1_end),
            (chunk2_start, chunk2_end),
            (chunk3_start, required_to),
        ):
            response = self._upload(
                digest,
                requirement_id=bank_statement["application_requirement_id"],
                lock_version=lock_version,
                coverage_from=chunk_from.isoformat(),
                coverage_to=chunk_to.isoformat(),
                filename=f"statement-{chunk_from.isoformat()}.pdf",
            )
            self.assertEqual(201, response.status_code, response.text)
            lock_version = response.json()["lock_version"]

        updated = self._find_requirement(
            response.json(), "bank_statement", attaches_to="entity"
        )
        self.assertEqual("collected", updated["status"])
        self.assertEqual(3, len(updated["documents"]))
        document_ids = {document["document_id"] for document in updated["documents"]}
        self.assertEqual(3, len(document_ids))

    # -- re-upload / supersede ------------------------------------------------

    def test_reupload_supersedes_the_previous_document(self) -> None:
        digest = self._create_session()
        started = self._start_application(digest)
        requirements = self._requirements(digest)
        pan_requirement = self._find_requirement(
            requirements, "pan_card", attaches_to="person"
        )

        first = self._upload(
            digest,
            requirement_id=pan_requirement["application_requirement_id"],
            lock_version=started["lock_version"],
        )
        self.assertEqual(201, first.status_code, first.text)
        first_document_id = self._find_requirement(
            first.json(), "pan_card", attaches_to="person"
        )["documents"][0]["document_id"]

        second = self._upload(
            digest,
            requirement_id=pan_requirement["application_requirement_id"],
            lock_version=first.json()["lock_version"],
            supersedes_document_id=first_document_id,
            scan=False,
        )
        self.assertEqual(201, second.status_code, second.text)
        before_scan = self._find_requirement(
            second.json(), "pan_card", attaches_to="person"
        )
        self.assertEqual("collected", before_scan["status"])
        self.assertEqual(2, len(before_scan["documents"]))
        old_before_scan = asyncio.run(
            _fetch(
                "SELECT status FROM documents WHERE document_id = $1",
                uuid.UUID(first_document_id),
            )
        )
        self.assertEqual("uploaded", old_before_scan[0]["status"])

        pending_replacement = self._pending_document(
            pan_requirement["application_requirement_id"]
        )
        scanned = self._scan_document(
            pending_replacement,
            scanner_job_id="clean-replacement-job",
        )
        self.assertEqual(200, scanned.status_code, scanned.text)
        updated = self._find_requirement(
            self._requirements(digest), "pan_card", attaches_to="person"
        )
        self.assertEqual(1, len(updated["documents"]))
        self.assertNotEqual(first_document_id, updated["documents"][0]["document_id"])

        row = asyncio.run(
            _fetch(
                "SELECT status FROM documents WHERE document_id = $1",
                uuid.UUID(first_document_id),
            )
        )
        self.assertEqual("superseded", row[0]["status"])

    def test_reupload_cannot_supersede_another_partys_document(self) -> None:
        digest = self._create_session()
        started = self._start_application(digest, constitution="private_limited")
        created_party = self.client.post(
            "/api/apply/applications/current/parties",
            headers={SESSION_HEADER: digest},
            json={
                "full_name": "Ravi Rao",
                "mobile_number": "9876543211",
                "email": "ravi@example.com",
                "type_of_residence": "owned",
                "employment_status_code": "self_employed",
                "role": "director",
                "ownership_pct": 20,
                "expected_lock_version": started["lock_version"],
            },
        )
        self.assertEqual(201, created_party.status_code, created_party.text)
        added_party_id = next(
            party["party_id"]
            for party in created_party.json()["parties"]
            if not party["is_primary"]
        )
        requirements = self._requirements(digest)
        primary_pan = next(
            row
            for row in requirements["requirements"]
            if row["document_type_code"] == "pan_card"
            and row["application_party_id"] != added_party_id
        )
        added_party_pan = self._find_requirement(
            requirements,
            "pan_card",
            attaches_to="person",
            application_party_id=added_party_id,
        )
        uploaded = self._upload(
            digest,
            requirement_id=primary_pan["application_requirement_id"],
            lock_version=created_party.json()["lock_version"],
        )
        self.assertEqual(201, uploaded.status_code, uploaded.text)
        first_document_id = self._find_requirement(
            uploaded.json(),
            "pan_card",
            application_party_id=primary_pan["application_party_id"],
        )["documents"][0]["document_id"]

        rejected = self._upload(
            digest,
            requirement_id=added_party_pan["application_requirement_id"],
            lock_version=uploaded.json()["lock_version"],
            supersedes_document_id=first_document_id,
        )

        self.assertEqual(404, rejected.status_code, rejected.text)
        unchanged = self._requirements(digest)
        self.assertEqual(
            "collected",
            self._find_requirement(
                unchanged,
                "pan_card",
                application_party_id=primary_pan["application_party_id"],
            )["status"],
        )
        self.assertEqual(
            "pending",
            self._find_requirement(
                unchanged,
                "pan_card",
                application_party_id=added_party_id,
            )["status"],
        )

    # -- delete -----------------------------------------------------------

    def test_delete_document_reverts_requirement_to_pending(self) -> None:
        digest = self._create_session()
        started = self._start_application(digest)
        requirements = self._requirements(digest)
        pan_requirement = self._find_requirement(
            requirements, "pan_card", attaches_to="person"
        )

        uploaded = self._upload(
            digest,
            requirement_id=pan_requirement["application_requirement_id"],
            lock_version=started["lock_version"],
        ).json()
        document_id = self._find_requirement(
            uploaded, "pan_card", attaches_to="person"
        )["documents"][0]["document_id"]

        response = self.client.request(
            "DELETE",
            f"/api/apply/applications/current/documents/{document_id}",
            headers={SESSION_HEADER: digest},
            params={"expected_lock_version": uploaded["lock_version"]},
        )
        self.assertEqual(200, response.status_code, response.text)
        updated = self._find_requirement(
            response.json(), "pan_card", attaches_to="person"
        )
        self.assertEqual("pending", updated["status"])
        self.assertEqual(0, len(updated["documents"]))

    # -- P4-H01: physical deletion must not diverge from the DB commit -------

    def _stored_objects(self) -> dict[str, bytes]:
        return self.gcs_client.bucket(TEST_BUCKET).objects

    def _stored_key(self, application_id: str, document_id: str) -> str:
        return (
            "clean/10000000-0000-0000-0000-000000000001/"
            f"{application_id}/{document_id}.pdf"
        )

    def _upload_one_pan_document(self, digest: str) -> tuple[dict, str, str]:
        started = self._start_application(digest)
        requirements = self._requirements(digest)
        pan_requirement = self._find_requirement(
            requirements, "pan_card", attaches_to="person"
        )
        uploaded = self._upload(
            digest,
            requirement_id=pan_requirement["application_requirement_id"],
            lock_version=started["lock_version"],
        ).json()
        document_id = self._find_requirement(
            uploaded, "pan_card", attaches_to="person"
        )["documents"][0]["document_id"]
        object_key = self._stored_key(uploaded["application_id"], document_id)
        self.assertIn(
            object_key,
            self._stored_objects(),
            "uploaded object should exist before deletion",
        )
        return uploaded, document_id, object_key

    def test_failed_upload_transaction_compensates_the_quarantine_object(self) -> None:
        digest = self._create_session()
        started = self._start_application(digest)
        pan_requirement = self._find_requirement(
            self._requirements(digest), "pan_card", attaches_to="person"
        )
        objects_before = set(self._stored_objects())
        real_tenant_session = collection_requirements.tenant_session

        @asynccontextmanager
        async def fail_before_commit(tenant_id: uuid.UUID):
            async with real_tenant_session(tenant_id) as database:
                yield database
                raise RuntimeError("forced transaction-exit failure")

        with mock.patch(
            "services.collection_requirements.tenant_session",
            fail_before_commit,
        ):
            with self.assertRaisesRegex(RuntimeError, "transaction-exit"):
                self._upload(
                    digest,
                    requirement_id=pan_requirement["application_requirement_id"],
                    lock_version=started["lock_version"],
                    scan=False,
                )

        self.assertEqual(objects_before, set(self._stored_objects()))
        rows = asyncio.run(
            _fetch(
                "SELECT document_id FROM documents WHERE application_id = $1",
                uuid.UUID(started["application_id"]),
            )
        )
        self.assertEqual([], rows)

    def test_failed_scan_transaction_removes_only_promoted_copy_and_can_retry(
        self,
    ) -> None:
        digest = self._create_session()
        started = self._start_application(digest)
        pan_requirement = self._find_requirement(
            self._requirements(digest), "pan_card", attaches_to="person"
        )
        uploaded = self._upload(
            digest,
            requirement_id=pan_requirement["application_requirement_id"],
            lock_version=started["lock_version"],
            scan=False,
        )
        self.assertEqual(201, uploaded.status_code, uploaded.text)
        document = self._pending_document(pan_requirement["application_requirement_id"])
        quarantine_key = document["gcs_object"]
        clean_key = quarantine_key.replace("quarantine/", "clean/", 1)
        real_tenant_session = collection_requirements.tenant_session

        @asynccontextmanager
        async def fail_before_commit(tenant_id: uuid.UUID):
            async with real_tenant_session(tenant_id) as database:
                yield database
                raise RuntimeError("forced scan transaction-exit failure")

        with mock.patch(
            "services.collection_requirements.tenant_session",
            fail_before_commit,
        ):
            with self.assertRaisesRegex(RuntimeError, "scan transaction-exit"):
                self._scan_document(
                    document,
                    scanner_job_id="rollback-clean-scan-job",
                )

        self.assertIn(quarantine_key, self._stored_objects())
        self.assertNotIn(clean_key, self._stored_objects())
        rolled_back = asyncio.run(
            _fetch(
                "SELECT status, scan_result, scan_job_id FROM documents WHERE document_id = $1",
                document["document_id"],
            )
        )[0]
        self.assertEqual("quarantined", rolled_back["status"])
        self.assertEqual("pending", rolled_back["scan_result"])
        self.assertIsNone(rolled_back["scan_job_id"])

        retried = self._scan_document(
            document,
            scanner_job_id="retry-clean-scan-job",
        )
        self.assertEqual(200, retried.status_code, retried.text)
        self.assertNotIn(quarantine_key, self._stored_objects())
        self.assertIn(clean_key, self._stored_objects())

    def test_committed_delete_removes_the_physical_file(self) -> None:
        digest = self._create_session()
        uploaded, document_id, object_key = self._upload_one_pan_document(digest)

        response = self.client.request(
            "DELETE",
            f"/api/apply/applications/current/documents/{document_id}",
            headers={SESSION_HEADER: digest},
            params={"expected_lock_version": uploaded["lock_version"]},
        )

        self.assertEqual(200, response.status_code, response.text)
        self.assertNotIn(
            object_key,
            self._stored_objects(),
            "committed delete should remove the object",
        )
        rows = asyncio.run(
            _fetch(
                "SELECT status FROM documents WHERE document_id = $1",
                uuid.UUID(document_id),
            )
        )
        self.assertEqual("purged", rows[0]["status"])

    def test_rolled_back_delete_leaves_the_file_and_the_document_row_intact(
        self,
    ) -> None:
        digest = self._create_session()
        uploaded, document_id, object_key = self._upload_one_pan_document(digest)

        # Fail the transaction after the delete bookkeeping has run but before
        # it commits. The object must survive, or the surviving 'uploaded' row
        # would point at an object that no longer exists.
        with mock.patch(
            "services.collection_requirements.serialize_requirements",
            side_effect=RuntimeError("forced rollback"),
        ):
            with self.assertRaises(RuntimeError):
                self.client.request(
                    "DELETE",
                    f"/api/apply/applications/current/documents/{document_id}",
                    headers={SESSION_HEADER: digest},
                    params={"expected_lock_version": uploaded["lock_version"]},
                )

        self.assertIn(
            object_key,
            self._stored_objects(),
            "rolled-back delete must not remove the object",
        )
        rows = asyncio.run(
            _fetch(
                "SELECT status FROM documents WHERE document_id = $1",
                uuid.UUID(document_id),
            )
        )
        self.assertEqual("uploaded", rows[0]["status"])
        still_collected = self._find_requirement(
            self._requirements(digest), "pan_card", attaches_to="person"
        )
        self.assertEqual("collected", still_collected["status"])
        self.assertEqual(1, len(still_collected["documents"]))

    def test_post_commit_cleanup_failure_keeps_the_committed_delete(self) -> None:
        digest = self._create_session()
        uploaded, document_id, _ = self._upload_one_pan_document(digest)

        # A failing physical delete after commit must not turn a successful,
        # already-committed database change into an error response.
        with mock.patch.object(
            collection_requirements._STORAGE,
            "delete",
            side_effect=OSError("disk gone"),
        ):
            response = self.client.request(
                "DELETE",
                f"/api/apply/applications/current/documents/{document_id}",
                headers={SESSION_HEADER: digest},
                params={"expected_lock_version": uploaded["lock_version"]},
            )

        self.assertEqual(200, response.status_code, response.text)
        rows = asyncio.run(
            _fetch(
                "SELECT status FROM documents WHERE document_id = $1",
                uuid.UUID(document_id),
            )
        )
        self.assertEqual("purged", rows[0]["status"])

    def test_clearing_facilities_removes_their_files_only_after_commit(self) -> None:
        digest = self._create_session()
        started = self._start_application(digest)

        declared = self.client.put(
            "/api/apply/applications/current/credit-declaration",
            headers={SESSION_HEADER: digest},
            json={
                "has_active_credit_facilities": True,
                "declared_cibil_score": 750,
                "expected_lock_version": started["lock_version"],
            },
        ).json()
        created = self.client.post(
            "/api/apply/applications/current/credit-facilities",
            headers={SESSION_HEADER: digest},
            json={
                **self._facility_payload(),
                "expected_lock_version": declared["lock_version"],
            },
        ).json()
        sanction = self._find_requirement(
            created, "sanction_letter", attaches_to="facility"
        )
        uploaded = self._upload(
            digest,
            requirement_id=sanction["application_requirement_id"],
            lock_version=created["lock_version"],
        ).json()
        document_id = self._find_requirement(
            uploaded, "sanction_letter", attaches_to="facility"
        )["documents"][0]["document_id"]
        object_key = self._stored_key(uploaded["application_id"], document_id)
        self.assertIn(object_key, self._stored_objects())

        # Reverting the declaration clears facilities and their documents.
        with mock.patch(
            "services.collection_requirements.serialize_requirements",
            side_effect=RuntimeError("forced rollback"),
        ):
            with self.assertRaises(RuntimeError):
                self.client.put(
                    "/api/apply/applications/current/credit-declaration",
                    headers={SESSION_HEADER: digest},
                    json={
                        "has_active_credit_facilities": False,
                        "declared_cibil_score": 750,
                        "expected_lock_version": uploaded["lock_version"],
                    },
                )
        self.assertIn(
            object_key,
            self._stored_objects(),
            "rolled-back facility clear must keep the object",
        )

        response = self.client.put(
            "/api/apply/applications/current/credit-declaration",
            headers={SESSION_HEADER: digest},
            json={
                "has_active_credit_facilities": False,
                "declared_cibil_score": 750,
                "expected_lock_version": uploaded["lock_version"],
            },
        )
        self.assertEqual(200, response.status_code, response.text)
        self.assertEqual(0, len(response.json()["facilities"]))
        self.assertNotIn(
            object_key,
            self._stored_objects(),
            "committed facility clear should remove the object",
        )

    def test_delete_unknown_document_is_not_found(self) -> None:
        digest = self._create_session()
        started = self._start_application(digest)

        response = self.client.request(
            "DELETE",
            "/api/apply/applications/current/documents/00000000-0000-0000-0000-000000000000",
            headers={SESSION_HEADER: digest},
            params={"expected_lock_version": started["lock_version"]},
        )
        self.assertEqual(404, response.status_code, response.text)

    # -- existing credit facilities -----------------------------------------

    def test_declaring_no_active_facilities_creates_no_facility_requirements(
        self,
    ) -> None:
        digest = self._create_session()
        started = self._start_application(digest)

        response = self.client.put(
            "/api/apply/applications/current/credit-declaration",
            headers={SESSION_HEADER: digest},
            json={
                "has_active_credit_facilities": False,
                "declared_cibil_score": 750,
                "expected_lock_version": started["lock_version"],
            },
        )
        self.assertEqual(200, response.status_code, response.text)
        facility_rows = [
            row
            for row in response.json()["requirements"]
            if row["attaches_to"] == "facility"
        ]
        self.assertEqual(0, len(facility_rows))

    def test_declaring_active_facilities_and_adding_one_materializes_facility_requirements(
        self,
    ) -> None:
        digest = self._create_session()
        started = self._start_application(digest)

        declared = self.client.put(
            "/api/apply/applications/current/credit-declaration",
            headers={SESSION_HEADER: digest},
            json={
                "has_active_credit_facilities": True,
                "declared_cibil_score": 700,
                "expected_lock_version": started["lock_version"],
            },
        )
        self.assertEqual(200, declared.status_code, declared.text)

        created = self.client.post(
            "/api/apply/applications/current/credit-facilities",
            headers={SESSION_HEADER: digest},
            json=self._facility_payload(
                expected_lock_version=declared.json()["lock_version"]
            ),
        )
        self.assertEqual(201, created.status_code, created.text)
        body = created.json()
        self.assertEqual(1, len(body["facilities"]))
        facility = body["facilities"][0]
        self.assertEqual(200000, facility["original_loan_amount"])
        self.assertEqual(11.5, facility["interest_rate_percent"])
        self.assertEqual(36, facility["tenure_months"])
        self.assertEqual("2024-01-01", facility["start_date"])
        self.assertEqual("2027-01-01", facility["end_date"])
        self.assertEqual(12, facility["emis_paid_count"])
        facility_id = body["facilities"][0]["facility_id"]
        facility_rows = [
            row for row in body["requirements"] if row["attaches_to"] == "facility"
        ]
        self.assertEqual(1, len(facility_rows))
        self.assertTrue(all(row["facility_id"] == facility_id for row in facility_rows))
        self.assertEqual(
            {"sanction_letter"},
            {row["document_type_code"] for row in facility_rows},
        )

        sanction_letter = self._find_requirement(
            self._requirements(digest), "sanction_letter", facility_id=facility_id
        )
        uploaded = self._upload(
            digest,
            requirement_id=sanction_letter["application_requirement_id"],
            lock_version=created.json()["lock_version"],
        )
        self.assertEqual(201, uploaded.status_code, uploaded.text)
        self.assertEqual(
            "collected",
            self._find_requirement(
                uploaded.json(), "sanction_letter", facility_id=facility_id
            )["status"],
        )

    def test_facility_fields_survive_a_refresh_via_get_requirements(self) -> None:
        digest = self._create_session()
        started = self._start_application(digest)
        declared = self.client.put(
            "/api/apply/applications/current/credit-declaration",
            headers={SESSION_HEADER: digest},
            json={
                "has_active_credit_facilities": True,
                "declared_cibil_score": 700,
                "expected_lock_version": started["lock_version"],
            },
        )
        payload = self._facility_payload(
            lender_name="Refresh Bank",
            expected_lock_version=declared.json()["lock_version"],
        )
        created = self.client.post(
            "/api/apply/applications/current/credit-facilities",
            headers={SESSION_HEADER: digest},
            json=payload,
        )
        self.assertEqual(201, created.status_code, created.text)

        # Simulate a page refresh: a fresh GET, not the mutation response.
        reloaded = self._requirements(digest)

        self.assertEqual(1, len(reloaded["facilities"]))
        facility = reloaded["facilities"][0]
        self.assertEqual(payload["facility_type"], facility["facility_type"])
        self.assertEqual(payload["lender_name"], facility["lender_name"])
        self.assertEqual(
            payload["original_loan_amount"], facility["original_loan_amount"]
        )
        self.assertEqual(payload["outstanding_amount"], facility["outstanding_amount"])
        self.assertEqual(payload["emi_amount"], facility["emi_amount"])
        self.assertEqual(
            payload["interest_rate_percent"], facility["interest_rate_percent"]
        )
        self.assertEqual(payload["tenure_months"], facility["tenure_months"])
        self.assertEqual(payload["start_date"], facility["start_date"])
        self.assertEqual(payload["end_date"], facility["end_date"])
        self.assertEqual(payload["emis_paid_count"], facility["emis_paid_count"])

    def test_multiple_facilities_each_keep_their_own_fields_requirements_and_documents(
        self,
    ) -> None:
        digest = self._create_session()
        started = self._start_application(digest)

        declared = self.client.put(
            "/api/apply/applications/current/credit-declaration",
            headers={SESSION_HEADER: digest},
            json={
                "has_active_credit_facilities": True,
                "declared_cibil_score": 700,
                "expected_lock_version": started["lock_version"],
            },
        )

        created_a = self.client.post(
            "/api/apply/applications/current/credit-facilities",
            headers={SESSION_HEADER: digest},
            json=self._facility_payload(
                facility_type="business",
                lender_name="Bank A",
                original_loan_amount=200000,
                outstanding_amount=100000,
                emi_amount=5000,
                interest_rate_percent=11.5,
                tenure_months=36,
                emis_paid_count=12,
                expected_lock_version=declared.json()["lock_version"],
            ),
        )
        self.assertEqual(201, created_a.status_code, created_a.text)

        created_b = self.client.post(
            "/api/apply/applications/current/credit-facilities",
            headers={SESSION_HEADER: digest},
            json=self._facility_payload(
                facility_type="personal",
                lender_name="Bank B",
                original_loan_amount=50000,
                outstanding_amount=20000,
                emi_amount=1500,
                interest_rate_percent=13.0,
                tenure_months=24,
                emis_paid_count=6,
                expected_lock_version=created_a.json()["lock_version"],
            ),
        )
        self.assertEqual(201, created_b.status_code, created_b.text)
        body = created_b.json()

        self.assertEqual(2, len(body["facilities"]))
        facility_by_lender = {
            facility["lender_name"]: facility for facility in body["facilities"]
        }
        self.assertEqual("business", facility_by_lender["Bank A"]["facility_type"])
        self.assertEqual(100000, facility_by_lender["Bank A"]["outstanding_amount"])
        self.assertEqual(11.5, facility_by_lender["Bank A"]["interest_rate_percent"])
        self.assertEqual(36, facility_by_lender["Bank A"]["tenure_months"])
        self.assertEqual(12, facility_by_lender["Bank A"]["emis_paid_count"])
        self.assertEqual("personal", facility_by_lender["Bank B"]["facility_type"])
        self.assertEqual(20000, facility_by_lender["Bank B"]["outstanding_amount"])
        self.assertEqual(13.0, facility_by_lender["Bank B"]["interest_rate_percent"])
        self.assertEqual(24, facility_by_lender["Bank B"]["tenure_months"])
        self.assertEqual(6, facility_by_lender["Bank B"]["emis_paid_count"])

        facility_id_a = facility_by_lender["Bank A"]["facility_id"]
        facility_id_b = facility_by_lender["Bank B"]["facility_id"]
        self.assertNotEqual(facility_id_a, facility_id_b)

        facility_rows = [
            row for row in body["requirements"] if row["attaches_to"] == "facility"
        ]
        self.assertEqual(2, len(facility_rows))
        rows_by_facility: dict[str, set[str]] = {}
        for row in facility_rows:
            rows_by_facility.setdefault(row["facility_id"], set()).add(
                row["document_type_code"]
            )
        self.assertEqual({"sanction_letter"}, rows_by_facility[facility_id_a])
        self.assertEqual({"sanction_letter"}, rows_by_facility[facility_id_b])
        requirement_ids = {row["application_requirement_id"] for row in facility_rows}
        self.assertEqual(2, len(requirement_ids))

        current = self._requirements(digest)
        sanction_letter_a = self._find_requirement(
            current, "sanction_letter", facility_id=facility_id_a
        )
        uploaded = self._upload(
            digest,
            requirement_id=sanction_letter_a["application_requirement_id"],
            lock_version=current["lock_version"],
        )
        self.assertEqual(201, uploaded.status_code, uploaded.text)
        after = uploaded.json()

        self.assertEqual(
            "collected",
            self._find_requirement(after, "sanction_letter", facility_id=facility_id_a)[
                "status"
            ],
        )
        # A document uploaded against facility A's requirement must not
        # satisfy facility B's same-document-type requirement.
        # (Checklist v2 leaves sanction_letter as the only per-facility
        # requirement, so cross-document-type isolation within one facility is
        # no longer expressible here.)
        self.assertEqual(
            "pending",
            self._find_requirement(after, "sanction_letter", facility_id=facility_id_b)[
                "status"
            ],
        )

    def test_creating_a_facility_without_declaration_is_rejected(self) -> None:
        digest = self._create_session()
        started = self._start_application(digest)

        response = self.client.post(
            "/api/apply/applications/current/credit-facilities",
            headers={SESSION_HEADER: digest},
            json=self._facility_payload(expected_lock_version=started["lock_version"]),
        )
        self.assertEqual(422, response.status_code, response.text)

    def test_creating_a_facility_rejects_an_end_date_before_the_start_date(
        self,
    ) -> None:
        digest = self._create_session()
        started = self._start_application(digest)
        declared = self.client.put(
            "/api/apply/applications/current/credit-declaration",
            headers={SESSION_HEADER: digest},
            json={
                "has_active_credit_facilities": True,
                "declared_cibil_score": 700,
                "expected_lock_version": started["lock_version"],
            },
        )

        response = self.client.post(
            "/api/apply/applications/current/credit-facilities",
            headers={SESSION_HEADER: digest},
            json=self._facility_payload(
                start_date="2027-01-01",
                end_date="2024-01-01",
                expected_lock_version=declared.json()["lock_version"],
            ),
        )
        self.assertEqual(422, response.status_code, response.text)

    def test_creating_a_facility_rejects_each_invalid_field_individually(self) -> None:
        digest = self._create_session()
        started = self._start_application(digest)
        declared = self.client.put(
            "/api/apply/applications/current/credit-declaration",
            headers={SESSION_HEADER: digest},
            json={
                "has_active_credit_facilities": True,
                "declared_cibil_score": 700,
                "expected_lock_version": started["lock_version"],
            },
        )
        lock_version = declared.json()["lock_version"]

        invalid_overrides = {
            "original_loan_amount": -1,
            "outstanding_amount": -1,
            "emi_amount": -1,
            "interest_rate_percent": 150,
            "tenure_months": 0,
            "emis_paid_count": -1,
        }
        for field, bad_value in invalid_overrides.items():
            with self.subTest(field=field):
                response = self.client.post(
                    "/api/apply/applications/current/credit-facilities",
                    headers={SESSION_HEADER: digest},
                    json=self._facility_payload(
                        **{field: bad_value}, expected_lock_version=lock_version
                    ),
                )
                self.assertEqual(422, response.status_code, response.text)

        row = asyncio.run(
            _fetch("SELECT count(*) AS n FROM application_existing_credit_facilities")
        )
        self.assertEqual(0, row[0]["n"])

    def test_reverting_declaration_to_false_clears_facilities_and_their_requirements(
        self,
    ) -> None:
        digest = self._create_session()
        started = self._start_application(digest)

        declared = self.client.put(
            "/api/apply/applications/current/credit-declaration",
            headers={SESSION_HEADER: digest},
            json={
                "has_active_credit_facilities": True,
                "declared_cibil_score": 700,
                "expected_lock_version": started["lock_version"],
            },
        )
        created = self.client.post(
            "/api/apply/applications/current/credit-facilities",
            headers={SESSION_HEADER: digest},
            json=self._facility_payload(
                facility_type="personal",
                outstanding_amount=50000,
                emi_amount=2000,
                expected_lock_version=declared.json()["lock_version"],
            ),
        )
        self.assertEqual(201, created.status_code, created.text)

        reverted = self.client.put(
            "/api/apply/applications/current/credit-declaration",
            headers={SESSION_HEADER: digest},
            json={
                "has_active_credit_facilities": False,
                "declared_cibil_score": 700,
                "expected_lock_version": created.json()["lock_version"],
            },
        )
        self.assertEqual(200, reverted.status_code, reverted.text)
        body = reverted.json()
        self.assertEqual(0, len(body["facilities"]))
        self.assertEqual(
            0,
            len(
                [
                    row
                    for row in body["requirements"]
                    if row["attaches_to"] == "facility"
                ]
            ),
        )

        row = asyncio.run(
            _fetch("SELECT count(*) AS n FROM application_existing_credit_facilities")
        )
        self.assertEqual(0, row[0]["n"])


if __name__ == "__main__":
    unittest.main()
