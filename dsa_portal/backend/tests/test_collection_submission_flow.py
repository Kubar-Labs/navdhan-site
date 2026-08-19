from __future__ import annotations

import asyncio
import base64
import os
import secrets
import unittest
import uuid

import asyncpg
from fastapi.testclient import TestClient

from collection_app import build_collection_app
from tests.db_test_support import (
    TEST_DATABASE_URL,
    TEST_PG_DSN as PG_DSN,
    ensure_test_schema,
    guard_live_connection_is_test_database,
)


SESSION_HEADER = "x-navdhan-session-digest"
SERVICE_HEADER = "x-navdhan-service-token"
SERVICE_TOKEN = "test-backend-service-token-32-bytes-minimum"
MINIMAL_PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"


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
                "consent_grants",
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


async def _waive_blocking_document_requirements(application_id: str) -> None:
    connection = await asyncpg.connect(PG_DSN)
    try:
        await guard_live_connection_is_test_database(connection)
        await connection.execute(
            """
            UPDATE application_requirements
            SET status = 'waived'
            WHERE application_id = $1
              AND blocks_submission = true
              AND status NOT IN ('waived', 'not_applicable', 'collected', 'accepted_for_review')
            """,
            uuid.UUID(application_id),
        )
    finally:
        await connection.close()


class CollectionSubmissionFlowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls._previous_encryption_key = os.environ.get("ENCRYPTION_KEY")
        cls._previous_lookup_key = os.environ.get("LOOKUP_HMAC_KEY")
        cls._previous_service_token = os.environ.get("APPLY_SERVICE_TOKEN")
        os.environ["ENCRYPTION_KEY"] = base64.b64encode(
            secrets.token_bytes(32)
        ).decode()
        os.environ["LOOKUP_HMAC_KEY"] = base64.b64encode(
            secrets.token_bytes(32)
        ).decode()
        os.environ["APPLY_SERVICE_TOKEN"] = SERVICE_TOKEN
        from security import crypto

        crypto._cached_key = None

        # Documents go to GCS now, so point the service's storage at an
        # in-memory bucket instead of real credentials and a real bucket.
        from services import collection_requirements
        from storage.gcs import GCSStorage
        from tests.gcs_test_support import FakeGCSClient

        cls._collection_requirements = collection_requirements
        cls.gcs_client = FakeGCSClient()
        cls._previous_storage = collection_requirements._STORAGE
        collection_requirements._STORAGE = GCSStorage(
            bucket_name="navdhan-documents-test", client=cls.gcs_client
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
        ):
            if prior is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = prior
        cls._collection_requirements._STORAGE = cls._previous_storage
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

    def _start_application(self, digest: str) -> dict:
        response = self.client.put(
            "/api/apply/applications/current/loan-intent",
            headers={SESSION_HEADER: digest},
            json={
                "constitution": "proprietorship",
                "requested_amount": 500_000,
                "requested_tenure_months": 3,
                "purpose": "working_capital",
                "expected_lock_version": 0,
            },
        )
        self.assertEqual(200, response.status_code, response.text)
        return response.json()

    def _business_profile_payload(self, lock_version: int) -> dict:
        return {
            "business_legal_name": "Test Traders",
            "business_type_code": "trading",
            "income_type_code": "business_income",
            "type_of_office": "owned_office",
            "location_tier": "tier1",
            "business_pincode": "560001",
            "annual_turnover_range": "10_50",
            "gst_registered": False,
            "expected_lock_version": lock_version,
        }

    def _person_payload(self, lock_version: int) -> dict:
        return {
            "full_name": "Asha Rao",
            "mobile_number": "9876543210",
            "email": "asha@example.com",
            "type_of_residence": "owned",
            "employment_status_code": "self_employed",
            "expected_lock_version": lock_version,
        }

    def _save_business_profile_and_person(self, digest: str, application: dict) -> dict:
        response = self.client.put(
            "/api/apply/applications/current/business-profile",
            headers={SESSION_HEADER: digest},
            json=self._business_profile_payload(application["lock_version"]),
        )
        self.assertEqual(200, response.status_code, response.text)
        application = response.json()

        response = self.client.put(
            "/api/apply/applications/current/primary-person",
            headers={SESSION_HEADER: digest},
            json=self._person_payload(application["lock_version"]),
        )
        self.assertEqual(200, response.status_code, response.text)
        return response.json()

    def _save_primary_identifiers(self, digest: str, application: dict) -> dict:
        primary_party_id = next(
            p["party_id"] for p in application["parties"] if p["is_primary"]
        )

        response = self.client.put(
            f"/api/apply/applications/current/parties/{primary_party_id}/identifiers/pan",
            headers={SESSION_HEADER: digest},
            json={
                "pan_number": "ABCPD1234E",
                "expected_lock_version": application["lock_version"],
            },
        )
        self.assertEqual(200, response.status_code, response.text)
        application = response.json()

        response = self.client.put(
            f"/api/apply/applications/current/parties/{primary_party_id}/identifiers/aadhaar",
            headers={SESSION_HEADER: digest},
            json={
                "aadhaar_number": "123412341234",
                "expected_lock_version": application["lock_version"],
            },
        )
        self.assertEqual(200, response.status_code, response.text)
        return response.json()

    def _consent_grants_payload(
        self, lock_version: int, *, grant_mandatory: bool
    ) -> dict:
        return {
            "grants": {
                "privacy_policy": grant_mandatory,
                "terms_of_use": grant_mandatory,
                "credit_bureau_check": grant_mandatory,
                "communications": grant_mandatory,
            },
            "expected_lock_version": lock_version,
        }

    def _complete_minimal_application(
        self,
        digest: str,
        *,
        with_identifiers: bool = True,
        with_credit_declaration: bool = True,
    ) -> dict:
        application = self._start_application(digest)
        application = self._save_business_profile_and_person(digest, application)
        if with_identifiers:
            application = self._save_primary_identifiers(digest, application)
        asyncio.run(
            _waive_blocking_document_requirements(application["application_id"])
        )
        if with_credit_declaration:
            response = self.client.put(
                "/api/apply/applications/current/credit-declaration",
                headers={SESSION_HEADER: digest},
                json={
                    "has_active_credit_facilities": False,
                    "declared_cibil_score": 750,
                    "expected_lock_version": application["lock_version"],
                },
            )
            self.assertEqual(200, response.status_code, response.text)
            # Requirements-track responses intentionally return their own
            # snapshot rather than the application-track fields. Preserve the
            # already loaded application shape while adopting the shared lock
            # version advanced by this write.
            application = {**application, **response.json()}
        return application

    def _grant_mandatory_consent(self, digest: str, lock_version: int) -> dict:
        response = self.client.put(
            "/api/apply/applications/current/consent",
            headers={SESSION_HEADER: digest},
            json=self._consent_grants_payload(lock_version, grant_mandatory=True),
        )
        self.assertEqual(200, response.status_code, response.text)
        return response.json()

    # -- consent -----------------------------------------------------------

    def test_consent_purposes_are_listed_with_current_status(self) -> None:
        digest = self._create_session()
        self._start_application(digest)

        response = self.client.get(
            "/api/apply/applications/current/consent", headers={SESSION_HEADER: digest}
        )
        self.assertEqual(200, response.status_code, response.text)
        body = response.json()
        codes = {row["purpose_code"] for row in body["purposes"]}
        self.assertEqual(
            {
                "privacy_policy",
                "terms_of_use",
                "credit_bureau_check",
                "communications",
                "gst_verification",
            },
            codes,
        )
        mandatory = {
            row["purpose_code"]: row["is_mandatory"] for row in body["purposes"]
        }
        self.assertTrue(mandatory["privacy_policy"])
        self.assertTrue(mandatory["terms_of_use"])
        self.assertTrue(mandatory["credit_bureau_check"])
        self.assertFalse(mandatory["communications"])
        self.assertFalse(mandatory["gst_verification"])
        self.assertTrue(all(row["granted"] is False for row in body["purposes"]))

    def test_save_consent_rejects_missing_mandatory_purpose(self) -> None:
        digest = self._create_session()
        application = self._start_application(digest)

        response = self.client.put(
            "/api/apply/applications/current/consent",
            headers={SESSION_HEADER: digest},
            json={
                "grants": {"communications": True},
                "expected_lock_version": application["lock_version"],
            },
        )
        self.assertEqual(422, response.status_code, response.text)

    def test_save_consent_rejects_unknown_purpose(self) -> None:
        digest = self._create_session()
        application = self._start_application(digest)

        response = self.client.put(
            "/api/apply/applications/current/consent",
            headers={SESSION_HEADER: digest},
            json={
                "grants": {"not_a_real_purpose": True},
                "expected_lock_version": application["lock_version"],
            },
        )
        self.assertEqual(422, response.status_code, response.text)

    def test_save_consent_persists_and_reloads(self) -> None:
        digest = self._create_session()
        application = self._start_application(digest)

        saved = self._grant_mandatory_consent(digest, application["lock_version"])
        self.assertTrue(
            all(row["granted"] for row in saved["purposes"] if row["is_mandatory"])
        )

        reloaded = self.client.get(
            "/api/apply/applications/current/consent", headers={SESSION_HEADER: digest}
        ).json()
        self.assertTrue(
            all(row["granted"] for row in reloaded["purposes"] if row["is_mandatory"])
        )

    # -- submission gates ----------------------------------------------------

    def test_submit_blocked_when_document_requirement_pending(self) -> None:
        digest = self._create_session()
        application = self._start_application(digest)
        application = self._save_business_profile_and_person(digest, application)
        application = self._save_primary_identifiers(digest, application)
        # Deliberately skip waiving document requirements.
        application = self._grant_mandatory_consent(digest, application["lock_version"])

        response = self.client.post(
            "/api/apply/applications/current/submit",
            headers={SESSION_HEADER: digest},
            json={"expected_lock_version": application["lock_version"]},
        )
        self.assertEqual(422, response.status_code, response.text)
        missing = response.json()["detail"]["missing"]
        self.assertTrue(any(item.startswith("requirement:") for item in missing))

    def test_submit_recomputes_a_falsely_collected_requirement(self) -> None:
        digest = self._create_session()
        application = self._complete_minimal_application(digest)
        requirement_id = asyncio.run(
            _fetch(
                """
                UPDATE application_requirements
                SET status = 'collected'
                WHERE application_requirement_id = (
                    SELECT application_requirement_id
                    FROM application_requirements
                    WHERE application_id = $1 AND blocks_submission = true
                    ORDER BY application_requirement_id
                    LIMIT 1
                )
                RETURNING application_requirement_id
                """,
                uuid.UUID(application["application_id"]),
            )
        )[0]["application_requirement_id"]
        consent = self._grant_mandatory_consent(digest, application["lock_version"])

        response = self.client.post(
            "/api/apply/applications/current/submit",
            headers={SESSION_HEADER: digest},
            json={"expected_lock_version": consent["lock_version"]},
        )

        self.assertEqual(422, response.status_code, response.text)
        self.assertIn(
            f"requirement:{requirement_id}", response.json()["detail"]["missing"]
        )

    def test_submit_blocks_an_active_quarantined_document_even_if_requirement_is_waived(
        self,
    ) -> None:
        digest = self._create_session()
        application = self._complete_minimal_application(digest)
        requirements = self.client.get(
            "/api/apply/applications/current/requirements",
            headers={SESSION_HEADER: digest},
        ).json()
        requirement = next(
            row
            for row in requirements["requirements"]
            if row["coverage_mode"] == "none"
        )
        uploaded = self.client.post(
            "/api/apply/applications/current/documents",
            headers={SESSION_HEADER: digest},
            data={
                "application_requirement_id": requirement["application_requirement_id"],
                "expected_lock_version": str(application["lock_version"]),
            },
            files={"file": ("pending.pdf", MINIMAL_PDF, "application/pdf")},
        )
        self.assertEqual(201, uploaded.status_code, uploaded.text)
        consent = self._grant_mandatory_consent(digest, uploaded.json()["lock_version"])

        response = self.client.post(
            "/api/apply/applications/current/submit",
            headers={SESSION_HEADER: digest},
            json={"expected_lock_version": consent["lock_version"]},
        )

        self.assertEqual(422, response.status_code, response.text)
        self.assertTrue(
            any(
                item.startswith("document_scan:")
                for item in response.json()["detail"]["missing"]
            )
        )

    def test_submit_blocked_when_consent_missing(self) -> None:
        digest = self._create_session()
        application = self._complete_minimal_application(digest)

        response = self.client.post(
            "/api/apply/applications/current/submit",
            headers={SESSION_HEADER: digest},
            json={"expected_lock_version": application["lock_version"]},
        )
        self.assertEqual(422, response.status_code, response.text)
        missing = response.json()["detail"]["missing"]
        self.assertTrue(any(item.startswith("consent:") for item in missing))

    def test_submit_blocked_when_party_identifiers_missing(self) -> None:
        digest = self._create_session()
        application = self._complete_minimal_application(digest, with_identifiers=False)
        application = self._grant_mandatory_consent(digest, application["lock_version"])

        response = self.client.post(
            "/api/apply/applications/current/submit",
            headers={SESSION_HEADER: digest},
            json={"expected_lock_version": application["lock_version"]},
        )
        self.assertEqual(422, response.status_code, response.text)
        missing = response.json()["detail"]["missing"]
        self.assertTrue(any(item.startswith("party_pan:") for item in missing))
        self.assertTrue(any(item.startswith("party_aadhaar:") for item in missing))

    def test_submit_blocked_when_party_details_are_missing(self) -> None:
        digest = self._create_session()
        application = self._complete_minimal_application(digest)
        asyncio.run(_execute("UPDATE persons SET email_enc = NULL, email_hash = NULL"))
        application = self._grant_mandatory_consent(digest, application["lock_version"])

        response = self.client.post(
            "/api/apply/applications/current/submit",
            headers={SESSION_HEADER: digest},
            json={"expected_lock_version": application["lock_version"]},
        )

        self.assertEqual(422, response.status_code, response.text)
        self.assertTrue(
            any(
                item.startswith("party_details:")
                for item in response.json()["detail"]["missing"]
            )
        )

    def test_submit_blocked_when_credit_declaration_is_missing(self) -> None:
        digest = self._create_session()
        application = self._complete_minimal_application(
            digest, with_credit_declaration=False
        )
        application = self._grant_mandatory_consent(digest, application["lock_version"])

        response = self.client.post(
            "/api/apply/applications/current/submit",
            headers={SESSION_HEADER: digest},
            json={"expected_lock_version": application["lock_version"]},
        )

        self.assertEqual(422, response.status_code, response.text)
        self.assertIn("credit_declaration", response.json()["detail"]["missing"])

    def test_submit_blocked_when_active_credit_is_declared_without_a_facility(
        self,
    ) -> None:
        digest = self._create_session()
        application = self._complete_minimal_application(
            digest, with_credit_declaration=False
        )
        declaration = self.client.put(
            "/api/apply/applications/current/credit-declaration",
            headers={SESSION_HEADER: digest},
            json={
                "has_active_credit_facilities": True,
                "declared_cibil_score": 750,
                "expected_lock_version": application["lock_version"],
            },
        )
        self.assertEqual(200, declaration.status_code, declaration.text)
        consent = self._grant_mandatory_consent(
            digest, declaration.json()["lock_version"]
        )

        response = self.client.post(
            "/api/apply/applications/current/submit",
            headers={SESSION_HEADER: digest},
            json={"expected_lock_version": consent["lock_version"]},
        )

        self.assertEqual(422, response.status_code, response.text)
        self.assertIn("existing_credit_facility", response.json()["detail"]["missing"])

    def test_submit_blocked_when_current_gst_consent_is_missing(self) -> None:
        digest = self._create_session()
        application = self._complete_minimal_application(digest)
        profile_payload = self._business_profile_payload(application["lock_version"])
        profile_payload["gst_registered"] = True
        profile = self.client.put(
            "/api/apply/applications/current/business-profile",
            headers={SESSION_HEADER: digest},
            json=profile_payload,
        )
        self.assertEqual(200, profile.status_code, profile.text)
        gst = self.client.put(
            "/api/apply/applications/current/gst-registration",
            headers={SESSION_HEADER: digest},
            json={
                "gst_registered": True,
                "gst_consent": True,
                "gstin": "27ABCPD1234E1Z5",
                "state_code": "27",
                "expected_lock_version": profile.json()["lock_version"],
            },
        )
        self.assertEqual(200, gst.status_code, gst.text)
        asyncio.run(
            _execute(
                "DELETE FROM consent_grants WHERE purpose_code = 'gst_verification'"
            )
        )
        consent = self._grant_mandatory_consent(digest, gst.json()["lock_version"])

        response = self.client.post(
            "/api/apply/applications/current/submit",
            headers={SESSION_HEADER: digest},
            json={"expected_lock_version": consent["lock_version"]},
        )

        self.assertEqual(422, response.status_code, response.text)
        self.assertIn("consent:gst_verification", response.json()["detail"]["missing"])

    def test_submit_succeeds_and_returns_application_no(self) -> None:
        digest = self._create_session()
        application = self._complete_minimal_application(digest)
        consent = self._grant_mandatory_consent(digest, application["lock_version"])

        response = self.client.post(
            "/api/apply/applications/current/submit",
            headers={SESSION_HEADER: digest},
            json={"expected_lock_version": consent["lock_version"]},
        )
        self.assertEqual(200, response.status_code, response.text)
        body = response.json()
        self.assertEqual("submitted", body["status"])
        self.assertEqual(application["application_no"], body["application_no"])
        self.assertIsNotNone(body["submitted_at"])

    def test_resubmit_is_idempotent(self) -> None:
        digest = self._create_session()
        application = self._complete_minimal_application(digest)
        consent = self._grant_mandatory_consent(digest, application["lock_version"])

        first = self.client.post(
            "/api/apply/applications/current/submit",
            headers={SESSION_HEADER: digest},
            json={"expected_lock_version": consent["lock_version"]},
        )
        self.assertEqual(200, first.status_code, first.text)
        first_body = first.json()

        # A stale/wrong lock version must not matter once already submitted.
        second = self.client.post(
            "/api/apply/applications/current/submit",
            headers={SESSION_HEADER: digest},
            json={"expected_lock_version": 0},
        )
        self.assertEqual(200, second.status_code, second.text)
        second_body = second.json()

        self.assertEqual(first_body["application_no"], second_body["application_no"])
        self.assertEqual("submitted", second_body["status"])

        events = asyncio.run(
            _fetch(
                """
                SELECT count(*) AS submitted_count FROM application_status_events
                WHERE application_id = $1 AND to_status = 'submitted'
                """,
                uuid.UUID(application["application_id"]),
            )
        )
        self.assertEqual(1, events[0]["submitted_count"])

    # -- lock_version contract across different endpoint "tracks" ------------
    #
    # `loan_applications.lock_version` is one column shared by every mutation
    # endpoint (business-profile, credit-declaration, consent, ...). The
    # contract each response must uphold: it always returns the *current*
    # version, and using that returned version on the very next call — even
    # to a completely different endpoint — must succeed. This is the backend
    # half of the frontend lock-reconciliation fix (WizardShell.tsx): these
    # tests prove the backend was never the source of the false-positive
    # 409s, and guard against it regressing.

    def test_lock_version_returned_by_one_endpoint_is_accepted_by_a_different_endpoint(
        self,
    ) -> None:
        digest = self._create_session()
        application = self._start_application(digest)

        response = self.client.put(
            "/api/apply/applications/current/business-profile",
            headers={SESSION_HEADER: digest},
            json=self._business_profile_payload(application["lock_version"]),
        )
        self.assertEqual(200, response.status_code, response.text)
        after_profile = response.json()

        response = self.client.put(
            "/api/apply/applications/current/credit-declaration",
            headers={SESSION_HEADER: digest},
            json={
                "has_active_credit_facilities": False,
                "declared_cibil_score": 750,
                "expected_lock_version": after_profile["lock_version"],
            },
        )
        self.assertEqual(200, response.status_code, response.text)
        after_declaration = response.json()

        response = self.client.put(
            "/api/apply/applications/current/consent",
            headers={SESSION_HEADER: digest},
            json=self._consent_grants_payload(
                after_declaration["lock_version"], grant_mandatory=True
            ),
        )
        self.assertEqual(200, response.status_code, response.text)

    def test_a_lock_version_superseded_by_a_different_endpoints_write_still_returns_409(
        self,
    ) -> None:
        digest = self._create_session()
        application = self._start_application(digest)

        response = self.client.put(
            "/api/apply/applications/current/business-profile",
            headers={SESSION_HEADER: digest},
            json=self._business_profile_payload(application["lock_version"]),
        )
        after_profile = response.json()

        # A different endpoint advances the same shared column.
        response = self.client.put(
            "/api/apply/applications/current/credit-declaration",
            headers={SESSION_HEADER: digest},
            json={
                "has_active_credit_facilities": False,
                "declared_cibil_score": 750,
                "expected_lock_version": after_profile["lock_version"],
            },
        )
        self.assertEqual(200, response.status_code, response.text)

        # Reusing the version from *before* that write — a genuinely stale
        # version, not merely one tracked in a different frontend slice —
        # must still be rejected.
        response = self.client.put(
            "/api/apply/applications/current/consent",
            headers={SESSION_HEADER: digest},
            json=self._consent_grants_payload(
                after_profile["lock_version"], grant_mandatory=True
            ),
        )
        self.assertEqual(409, response.status_code, response.text)

    # -- submitted applications are locked -----------------------------------

    def _submitted_application(self, digest: str) -> dict:
        application = self._complete_minimal_application(digest)
        consent = self._grant_mandatory_consent(digest, application["lock_version"])
        response = self.client.post(
            "/api/apply/applications/current/submit",
            headers={SESSION_HEADER: digest},
            json={"expected_lock_version": consent["lock_version"]},
        )
        self.assertEqual(200, response.status_code, response.text)
        submitted = response.json()
        return {**application, "lock_version": submitted["lock_version"]}

    def test_submitted_application_rejects_every_mutation_path(self) -> None:
        digest = self._create_session()
        application = self._submitted_application(digest)
        lock = application["lock_version"]
        party_id = next(
            p["party_id"] for p in application["parties"] if p["is_primary"]
        )
        requirement_id = self.client.get(
            "/api/apply/applications/current/requirements",
            headers={SESSION_HEADER: digest},
        ).json()["requirements"][0]["application_requirement_id"]

        mutations = {
            "loan_intent": lambda: self.client.put(
                "/api/apply/applications/current/loan-intent",
                headers={SESSION_HEADER: digest},
                json={
                    "constitution": "proprietorship",
                    "requested_amount": 10_000_000,
                    "requested_tenure_months": 12,
                    "purpose": "machinery",
                    "expected_lock_version": lock,
                },
            ),
            "business_profile": lambda: self.client.put(
                "/api/apply/applications/current/business-profile",
                headers={SESSION_HEADER: digest},
                json=self._business_profile_payload(lock),
            ),
            "primary_person": lambda: self.client.put(
                "/api/apply/applications/current/primary-person",
                headers={SESSION_HEADER: digest},
                json=self._person_payload(lock),
            ),
            "add_party": lambda: self.client.post(
                "/api/apply/applications/current/parties",
                headers={SESSION_HEADER: digest},
                json={
                    "full_name": "New Partner",
                    "mobile_number": "9812345678",
                    "email": "partner@example.com",
                    "type_of_residence": "owned",
                    "employment_status_code": "salaried",
                    "role": "co_applicant",
                    "expected_lock_version": lock,
                },
            ),
            "update_party": lambda: self.client.put(
                f"/api/apply/applications/current/parties/{party_id}",
                headers={SESSION_HEADER: digest},
                json={
                    "full_name": "Renamed Person",
                    "mobile_number": "9812345678",
                    "email": "renamed@example.com",
                    "type_of_residence": "rented",
                    "employment_status_code": "salaried",
                    "expected_lock_version": lock,
                },
            ),
            "personal_pan": lambda: self.client.put(
                f"/api/apply/applications/current/parties/{party_id}/identifiers/pan",
                headers={SESSION_HEADER: digest},
                json={"pan_number": "ZZZPZ9999Z", "expected_lock_version": lock},
            ),
            "personal_aadhaar": lambda: self.client.put(
                f"/api/apply/applications/current/parties/{party_id}/identifiers/aadhaar",
                headers={SESSION_HEADER: digest},
                json={"aadhaar_number": "999988887777", "expected_lock_version": lock},
            ),
            "entity_pan": lambda: self.client.put(
                "/api/apply/applications/current/entity-pan",
                headers={SESSION_HEADER: digest},
                json={"entity_pan": "AAAPA1111A", "expected_lock_version": lock},
            ),
            "gst_registration": lambda: self.client.put(
                "/api/apply/applications/current/gst-registration",
                headers={SESSION_HEADER: digest},
                json={
                    "gst_registered": False,
                    "gst_consent": False,
                    "expected_lock_version": lock,
                },
            ),
            "credit_declaration": lambda: self.client.put(
                "/api/apply/applications/current/credit-declaration",
                headers={SESSION_HEADER: digest},
                json={
                    "has_active_credit_facilities": True,
                    "declared_cibil_score": 700,
                    "expected_lock_version": lock,
                },
            ),
            "credit_facility": lambda: self.client.post(
                "/api/apply/applications/current/credit-facilities",
                headers={SESSION_HEADER: digest},
                json={
                    "facility_type": "business",
                    "lender_name": "Late Bank",
                    "original_loan_amount": 100000,
                    "outstanding_amount": 50000,
                    "emi_amount": 2500,
                    "interest_rate_percent": 10.0,
                    "tenure_months": 24,
                    "start_date": "2024-01-01",
                    "end_date": "2026-01-01",
                    "emis_paid_count": 6,
                    "expected_lock_version": lock,
                },
            ),
            "consent": lambda: self.client.put(
                "/api/apply/applications/current/consent",
                headers={SESSION_HEADER: digest},
                json=self._consent_grants_payload(lock, grant_mandatory=True),
            ),
            "document_upload": lambda: self.client.post(
                "/api/apply/applications/current/documents",
                headers={SESSION_HEADER: digest},
                data={
                    "application_requirement_id": requirement_id,
                    "expected_lock_version": str(lock),
                },
                files={"file": ("late.pdf", MINIMAL_PDF, "application/pdf")},
            ),
            "document_delete": lambda: self.client.delete(
                f"/api/apply/applications/current/documents/{uuid.uuid4()}"
                f"?expected_lock_version={lock}",
                headers={SESSION_HEADER: digest},
            ),
        }

        for name, call in mutations.items():
            with self.subTest(mutation=name):
                response = call()
                self.assertEqual(409, response.status_code, f"{name}: {response.text}")
                self.assertEqual(
                    "This application has already been submitted.",
                    response.json()["detail"],
                )

        # Nothing changed: the submitted record still reads as submitted with
        # its original requested amount.
        current = self.client.get(
            "/api/apply/applications/current", headers={SESSION_HEADER: digest}
        ).json()
        self.assertEqual("submitted", current["status"])
        self.assertEqual(500_000, current["values"]["requested_amount"])

    def test_in_progress_application_remains_editable(self) -> None:
        digest = self._create_session()
        application = self._start_application(digest)

        response = self.client.put(
            "/api/apply/applications/current/business-profile",
            headers={SESSION_HEADER: digest},
            json=self._business_profile_payload(application["lock_version"]),
        )
        self.assertEqual(200, response.status_code, response.text)

        response = self.client.put(
            "/api/apply/applications/current/loan-intent",
            headers={SESSION_HEADER: digest},
            json={
                "constitution": "proprietorship",
                "requested_amount": 700_000,
                "requested_tenure_months": 6,
                "purpose": "inventory",
                "expected_lock_version": response.json()["lock_version"],
            },
        )
        self.assertEqual(200, response.status_code, response.text)
        self.assertEqual(700_000, response.json()["values"]["requested_amount"])


if __name__ == "__main__":
    unittest.main()
