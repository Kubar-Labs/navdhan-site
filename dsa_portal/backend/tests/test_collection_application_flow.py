from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import os
import secrets
import unittest
from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import asyncpg
from fastapi.testclient import TestClient

from collection_app import build_collection_app
from tests.db_test_support import (
    TEST_DATABASE_URL,
    TEST_PG_DSN as PG_DSN,
    ensure_test_schema,
    guard_live_connection_is_test_database,
)


MARKETPLACE_ID = "10000000-0000-0000-0000-000000000001"
SESSION_HEADER = "x-navdhan-session-digest"


async def _execute(statement: str, *arguments: object) -> str:
    connection = await asyncpg.connect(PG_DSN)
    try:
        return await connection.execute(statement, *arguments)
    finally:
        await connection.close()


async def _fetchrow(statement: str, *arguments: object) -> asyncpg.Record | None:
    connection = await asyncpg.connect(PG_DSN)
    try:
        return await connection.fetchrow(statement, *arguments)
    finally:
        await connection.close()


async def _fetch(statement: str, *arguments: object) -> list[asyncpg.Record]:
    connection = await asyncpg.connect(PG_DSN)
    try:
        return list(await connection.fetch(statement, *arguments))
    finally:
        await connection.close()


async def _clear_transaction_rows() -> None:
    """Delete only collection-flow transaction data, never seed/reference rows."""
    connection = await asyncpg.connect(PG_DSN)
    try:
        await guard_live_connection_is_test_database(connection)
        async with connection.transaction():
            for table in (
                "application_requirements",
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


class CollectionApplicationFlowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls._previous_encryption_key = os.environ.get("ENCRYPTION_KEY")
        cls._previous_lookup_key = os.environ.get("LOOKUP_HMAC_KEY")
        os.environ["ENCRYPTION_KEY"] = base64.b64encode(secrets.token_bytes(32)).decode()
        os.environ["LOOKUP_HMAC_KEY"] = base64.b64encode(secrets.token_bytes(32)).decode()
        from security import crypto

        crypto._cached_key = None
        asyncio.run(ensure_test_schema())
        asyncio.run(_clear_transaction_rows())
        cls.app = build_collection_app(database_url=TEST_DATABASE_URL)
        cls.client_context = TestClient(cls.app)
        cls.client = cls.client_context.__enter__()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.client_context.__exit__(None, None, None)
        asyncio.run(_clear_transaction_rows())
        for name, prior in (
            ("ENCRYPTION_KEY", cls._previous_encryption_key),
            ("LOOKUP_HMAC_KEY", cls._previous_lookup_key),
        ):
            if prior is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = prior
        from security import crypto

        crypto._cached_key = None

    def setUp(self) -> None:
        asyncio.run(_clear_transaction_rows())

    def _create_session(self) -> str:
        digest = secrets.token_hex(32)
        response = self.client.post(
            "/api/apply/session",
            json={"token_digest": digest},
        )
        self.assertEqual(201, response.status_code, response.text)
        return digest

    def _put_intent(self, digest: str, **overrides: object):
        payload: dict[str, object] = {
            "constitution": "proprietorship",
            "requested_amount": 500_000,
            "requested_tenure_months": 3,
            "purpose": "working_capital",
            "expected_lock_version": 0,
        }
        payload.update(overrides)
        return self.client.put(
            "/api/apply/applications/current/loan-intent",
            headers={SESSION_HEADER: digest},
            json=payload,
        )

    def test_session_stores_only_a_non_replayable_hash_for_seven_days(self) -> None:
        before = datetime.now(timezone.utc)
        digest = self._create_session()

        row = asyncio.run(
            _fetchrow(
                "SELECT token_hash, created_at, expires_at, application_id "
                "FROM application_sessions WHERE marketplace_id = $1",
                MARKETPLACE_ID,
            )
        )

        self.assertIsNotNone(row)
        presented_digest = bytes.fromhex(digest)
        self.assertNotEqual(presented_digest, bytes(row["token_hash"]))
        self.assertEqual(hashlib.sha256(presented_digest).digest(), bytes(row["token_hash"]))
        self.assertEqual(32, len(row["token_hash"]))
        self.assertIsNone(row["application_id"])
        self.assertGreaterEqual(row["created_at"], before)
        self.assertAlmostEqual(
            timedelta(days=7).total_seconds(),
            (row["expires_at"] - row["created_at"]).total_seconds(),
            delta=2,
        )
        replay = self.client.get(
            "/api/apply/applications/current",
            headers={SESSION_HEADER: bytes(row["token_hash"]).hex()},
        )
        self.assertEqual(401, replay.status_code)

    def test_session_rejects_non_lowercase_or_wrong_length_digest(self) -> None:
        for digest in ("0" * 63, "0" * 65, "A" * 64, "not-hex"):
            with self.subTest(digest=digest[:8]):
                response = self.client.post(
                    "/api/apply/session", json={"token_digest": digest}
                )
                self.assertEqual(422, response.status_code)

    def test_current_endpoints_reject_missing_unknown_expired_and_revoked_sessions(self) -> None:
        missing = self.client.get("/api/apply/applications/current")
        self.assertEqual(401, missing.status_code)

        unknown = self.client.get(
            "/api/apply/applications/current",
            headers={SESSION_HEADER: secrets.token_hex(32)},
        )
        self.assertEqual(401, unknown.status_code)

        for state in ("expired", "revoked"):
            with self.subTest(state=state):
                digest = self._create_session()
                if state == "expired":
                    asyncio.run(
                        _execute(
                            "UPDATE application_sessions SET created_at = now() - interval '2 days', "
                            "expires_at = now() - interval '1 day' "
                            "WHERE token_hash = $1",
                            hashlib.sha256(bytes.fromhex(digest)).digest(),
                        )
                    )
                else:
                    asyncio.run(
                        _execute(
                            "UPDATE application_sessions SET revoked_at = now() "
                            "WHERE token_hash = $1",
                            hashlib.sha256(bytes.fromhex(digest)).digest(),
                        )
                    )
                response = self.client.get(
                    "/api/apply/applications/current",
                    headers={SESSION_HEADER: digest},
                )
                self.assertEqual(401, response.status_code)

    def test_loan_intent_validation_is_frozen(self) -> None:
        invalid_cases = (
            {"constitution": "llp"},
            {"requested_amount": 499_999},
            {"requested_amount": 500_001},
            {"requested_amount": 10_010_000},
            {"requested_tenure_months": 2},
            {"requested_tenure_months": 13},
            {"purpose": "personal_holiday"},
            {"referral_code": "contains spaces"},
            {"referral_code": "x" * 21},
        )
        for override in invalid_cases:
            with self.subTest(override=override):
                digest = self._create_session()
                response = self._put_intent(digest, **override)
                self.assertEqual(422, response.status_code, response.text)

        digest = self._create_session()
        missing_version = self.client.put(
            "/api/apply/applications/current/loan-intent",
            headers={SESSION_HEADER: digest},
            json={
                "constitution": "proprietorship",
                "requested_amount": 500_000,
                "requested_tenure_months": 3,
                "purpose": "working_capital",
            },
        )
        self.assertEqual(422, missing_version.status_code, missing_version.text)

    def test_initialization_is_atomic_and_materializes_only_applicable_requirements(self) -> None:
        expected_counts = {
            "proprietorship": 14,
            "partnership": 16,
            "private_limited": 20,
        }
        for constitution, expected_count in expected_counts.items():
            with self.subTest(constitution=constitution):
                asyncio.run(_clear_transaction_rows())
                digest = self._create_session()
                response = self._put_intent(
                    digest,
                    constitution=constitution,
                    requested_amount=750_000,
                    requested_tenure_months=6,
                    purpose="inventory",
                    referral_code="PARTNER_1",
                )
                self.assertEqual(200, response.status_code, response.text)
                body = response.json()
                self.assertEqual("in_progress", body["status"])
                self.assertEqual("business_profile", body["current_step"])
                self.assertEqual(expected_count, body["requirements_count"])
                self.assertEqual(0, body["lock_version"])

                row = asyncio.run(
                    _fetchrow(
                        "SELECT "
                        "(SELECT count(*) FROM borrowers) AS borrowers, "
                        "(SELECT count(*) FROM persons) AS persons, "
                        "(SELECT count(*) FROM borrower_persons) AS borrower_persons, "
                        "(SELECT count(*) FROM loan_applications) AS applications, "
                        "(SELECT count(*) FROM application_parties) AS parties, "
                        "(SELECT count(*) FROM application_status_events) AS events, "
                        "(SELECT count(*) FROM application_requirements) AS requirements, "
                        "(SELECT count(*) FROM application_requirements WHERE attaches_to = 'facility') AS facilities, "
                        "(SELECT count(*) FROM application_requirements ar JOIN document_requirements dr "
                        " ON ar.requirement_id = dr.requirement_id WHERE dr.party_role = 'co_applicant') AS coapplicants, "
                        "(SELECT application_id FROM application_sessions LIMIT 1) AS linked_application"
                    )
                )
                self.assertEqual(1, row["borrowers"])
                self.assertEqual(1, row["persons"])
                self.assertEqual(1, row["borrower_persons"])
                self.assertEqual(1, row["applications"])
                self.assertEqual(1, row["parties"])
                self.assertEqual(1, row["events"])
                self.assertEqual(expected_count, row["requirements"])
                self.assertEqual(0, row["facilities"])
                self.assertEqual(0, row["coapplicants"])
                self.assertEqual(body["application_id"], str(row["linked_application"]))

    def test_repeated_put_updates_and_get_restores_the_same_application(self) -> None:
        digest = self._create_session()
        first = self._put_intent(digest, constitution="partnership")
        self.assertEqual(200, first.status_code, first.text)

        second = self._put_intent(
            digest,
            constitution="partnership",
            requested_amount=1_250_000,
            requested_tenure_months=9,
            purpose="business_expansion",
            referral_code=None,
            expected_lock_version=first.json()["lock_version"],
        )
        restored = self.client.get(
            "/api/apply/applications/current",
            headers={SESSION_HEADER: digest},
        )

        self.assertEqual(200, second.status_code, second.text)
        self.assertEqual(200, restored.status_code, restored.text)
        self.assertEqual(first.json()["application_id"], second.json()["application_id"])
        self.assertEqual(second.json(), restored.json())
        self.assertEqual(
            {
                "constitution": "partnership",
                "requested_amount": 1_250_000,
                "requested_tenure_months": 9,
                "purpose": "business_expansion",
                "referral_code": None,
            },
            restored.json()["values"],
        )

        row = asyncio.run(
            _fetchrow(
                "SELECT "
                "(SELECT count(*) FROM loan_applications) AS applications, "
                "(SELECT count(*) FROM application_requirements) AS requirements, "
                "(SELECT lock_version FROM loan_applications LIMIT 1) AS lock_version"
            )
        )
        self.assertEqual(1, row["applications"])
        self.assertEqual(16, row["requirements"])
        self.assertEqual(1, row["lock_version"])

    def test_stale_loan_intent_update_is_rejected_without_overwriting(self) -> None:
        digest = self._create_session()
        initial = self._put_intent(digest)
        self.assertEqual(200, initial.status_code, initial.text)
        view_one = initial.json()
        view_two = self.client.get(
            "/api/apply/applications/current", headers={SESSION_HEADER: digest}
        ).json()

        winner = self._put_intent(
            digest,
            requested_amount=800_000,
            expected_lock_version=view_one["lock_version"],
        )
        stale = self._put_intent(
            digest,
            requested_amount=900_000,
            expected_lock_version=view_two["lock_version"],
        )

        self.assertEqual(200, winner.status_code, winner.text)
        self.assertEqual(1, winner.json()["lock_version"])
        self.assertEqual(409, stale.status_code, stale.text)
        self.assertEqual(1, stale.json()["detail"]["current_lock_version"])
        restored = self.client.get(
            "/api/apply/applications/current", headers={SESSION_HEADER: digest}
        )
        self.assertEqual(800_000, restored.json()["values"]["requested_amount"])
        self.assertEqual(1, restored.json()["lock_version"])

    def test_constitution_change_atomically_repins_and_rematerializes_requirements(self) -> None:
        digest = self._create_session()
        initial = self._put_intent(digest, constitution="proprietorship")
        self.assertEqual(200, initial.status_code, initial.text)

        changed = self._put_intent(
            digest,
            constitution="private_limited",
            expected_lock_version=initial.json()["lock_version"],
        )

        self.assertEqual(200, changed.status_code, changed.text)
        self.assertEqual("private_limited", changed.json()["values"]["constitution"])
        self.assertEqual(20, changed.json()["requirements_count"])
        row = asyncio.run(
            _fetchrow(
                "SELECT la.constitution, cv.constitution AS checklist_constitution, "
                "b.constitution AS borrower_constitution, "
                "bp.role AS relationship_role, ap.role AS party_role, "
                "(SELECT count(*) FROM application_requirements) AS requirements "
                "FROM loan_applications la "
                "JOIN checklist_versions cv ON cv.checklist_version_id = la.checklist_version_id "
                "JOIN borrowers b ON b.borrower_id = la.borrower_id "
                "JOIN borrower_persons bp ON bp.borrower_id = b.borrower_id "
                "JOIN application_parties ap ON ap.application_id = la.application_id"
            )
        )
        self.assertEqual("private_limited", row["constitution"])
        self.assertEqual("private_limited", row["checklist_constitution"])
        self.assertEqual("private_limited", row["borrower_constitution"])
        self.assertEqual("director", row["relationship_role"])
        self.assertEqual("director", row["party_role"])
        self.assertEqual(20, row["requirements"])

    def test_materialized_requirements_snapshot_rolling_fiscal_and_fixed_windows(self) -> None:
        digest = self._create_session()
        response = self._put_intent(digest, constitution="private_limited")
        self.assertEqual(200, response.status_code, response.text)
        today = date.today()
        fiscal_year_start = date(today.year if today.month >= 4 else today.year - 1, 4, 1)
        expected_fiscal_start = date(fiscal_year_start.year - 2, 4, 1)
        expected_fiscal_end = fiscal_year_start - timedelta(days=1)
        rolling_start = date(today.year - 1, today.month, today.day)

        rows = asyncio.run(
            _fetch(
                "SELECT dr.document_type_code, dr.fixed_period_start, "
                "ar.coverage_mode, ar.min_count, dr.min_count AS source_min_count, "
                "ar.required_period_from, ar.required_period_to, ar.fiscal_year_start "
                "FROM application_requirements ar JOIN document_requirements dr "
                "ON ar.requirement_id = dr.requirement_id "
                "WHERE dr.coverage_mode <> 'none' ORDER BY dr.display_order"
            )
        )
        rolling = next(row for row in rows if row["document_type_code"] == "bank_statement")
        fiscal = next(row for row in rows if row["document_type_code"] == "itr")
        fixed = next(
            row
            for row in rows
            if row["document_type_code"] == "gstr_3b" and row["fixed_period_start"] is not None
        )
        self.assertEqual((rolling_start, today, None), (
            rolling["required_period_from"], rolling["required_period_to"], rolling["fiscal_year_start"]
        ))
        self.assertEqual((expected_fiscal_start, expected_fiscal_end, expected_fiscal_start), (
            fiscal["required_period_from"], fiscal["required_period_to"], fiscal["fiscal_year_start"]
        ))
        self.assertEqual((date(2025, 4, 1), today, None), (
            fixed["required_period_from"], fixed["required_period_to"], fixed["fiscal_year_start"]
        ))
        self.assertTrue(all(row["coverage_mode"] != "none" for row in rows))
        self.assertTrue(all(row["min_count"] == row["source_min_count"] for row in rows))

    def test_initialization_rolls_back_all_application_rows_on_failure(self) -> None:
        digest = self._create_session()
        with patch(
            "services.collection_application._materialize_requirements",
            new=AsyncMock(side_effect=RuntimeError("simulated materialization failure")),
        ):
            with self.assertRaisesRegex(RuntimeError, "simulated materialization failure"):
                self._put_intent(digest)

        row = asyncio.run(
            _fetchrow(
                "SELECT "
                "(SELECT count(*) FROM borrowers) AS borrowers, "
                "(SELECT count(*) FROM persons) AS persons, "
                "(SELECT count(*) FROM borrower_persons) AS borrower_persons, "
                "(SELECT count(*) FROM loan_applications) AS applications, "
                "(SELECT count(*) FROM application_parties) AS parties, "
                "(SELECT application_id FROM application_sessions LIMIT 1) AS linked_application"
            )
        )
        self.assertEqual(0, row["borrowers"])
        self.assertEqual(0, row["persons"])
        self.assertEqual(0, row["borrower_persons"])
        self.assertEqual(0, row["applications"])
        self.assertEqual(0, row["parties"])
        self.assertIsNone(row["linked_application"])

    def _put_business_profile(self, digest: str, expected: int, **overrides: object):
        payload: dict[str, object] = {
            "business_legal_name": "NavDhan Traders",
            "trade_name": "NavDhan",
            "business_type_code": "trading",
            "income_type_code": "business_income",
            "type_of_office": "rented_office",
            "location_tier": "tier2",
            "business_pincode": "560001",
            "annual_turnover_range": "10_50",
            "gst_registered": False,
            "expected_lock_version": expected,
        }
        payload.update(overrides)
        return self.client.put(
            "/api/apply/applications/current/business-profile",
            headers={SESSION_HEADER: digest},
            json=payload,
        )

    def _put_primary_person(self, digest: str, expected: int, **overrides: object):
        payload: dict[str, object] = {
            "full_name": "Anita Rao",
            "mobile_number": "9876543210",
            "email": "anita@example.com",
            "type_of_residence": "owned",
            "employment_status_code": "self_employed",
            "expected_lock_version": expected,
        }
        payload.update(overrides)
        return self.client.put(
            "/api/apply/applications/current/primary-person",
            headers={SESSION_HEADER: digest},
            json=payload,
        )

    def test_phase_three_business_and_primary_person_save_reload_masked(self) -> None:
        digest = self._create_session()
        intent = self._put_intent(digest, constitution="partnership")
        profile = self._put_business_profile(digest, intent.json()["lock_version"])
        person = self._put_primary_person(digest, profile.json()["lock_version"])
        restored = self.client.get(
            "/api/apply/applications/current", headers={SESSION_HEADER: digest}
        )

        self.assertEqual(200, profile.status_code, profile.text)
        self.assertEqual(200, person.status_code, person.text)
        self.assertEqual(person.json(), restored.json())
        snapshot = restored.json()
        self.assertEqual("NavDhan Traders", snapshot["business_profile"]["business_legal_name"])
        self.assertEqual("560001", snapshot["business_profile"]["business_pincode"])
        primary = snapshot["parties"][0]
        self.assertEqual("applicant", primary["role"])
        self.assertEqual("98XXXX3210", primary["mobile_masked"])
        self.assertEqual("a****@example.com", primary["email_masked"])
        self.assertNotIn("mobile_number", str(snapshot))
        self.assertNotIn("anita@example.com", str(snapshot))

        row = asyncio.run(
            _fetchrow(
                "SELECT b.legal_name, b.trade_name, b.business_type_code, b.type_of_office, "
                "b.location_tier, b.operating_address, b.attributes, la.income_type_code, "
                "p.full_name, p.mobile_enc, p.mobile_hash, p.email_enc, p.email_hash "
                "FROM loan_applications la JOIN borrowers b ON b.borrower_id = la.borrower_id "
                "JOIN application_parties ap ON ap.application_id = la.application_id "
                "JOIN persons p ON p.person_id = ap.person_id WHERE ap.is_primary"
            )
        )
        operating_address = (
            json.loads(row["operating_address"])
            if isinstance(row["operating_address"], str)
            else row["operating_address"]
        )
        attributes = (
            json.loads(row["attributes"])
            if isinstance(row["attributes"], str)
            else row["attributes"]
        )
        self.assertEqual("560001", operating_address["pincode"])
        self.assertEqual("10_50", attributes["annual_turnover_range"])
        self.assertFalse(attributes["gst_registered"])
        self.assertNotEqual(b"9876543210", bytes(row["mobile_enc"]))
        self.assertNotEqual(b"anita@example.com", bytes(row["email_enc"]))
        self.assertEqual(32, len(row["mobile_hash"]))
        self.assertEqual(32, len(row["email_hash"]))

    def test_phase_three_party_role_rules_and_kyc_requirement_materialization(self) -> None:
        cases = (
            ("proprietorship", "co_applicant", 422, 0),
            ("partnership", "co_applicant", 201, 2),
            ("private_limited", "director", 201, 3),
            ("private_limited", "co_applicant", 422, 0),
        )
        for constitution, role, status_code, expected_requirements in cases:
            with self.subTest(constitution=constitution, role=role):
                asyncio.run(_clear_transaction_rows())
                digest = self._create_session()
                intent = self._put_intent(digest, constitution=constitution)
                response = self.client.post(
                    "/api/apply/applications/current/parties",
                    headers={SESSION_HEADER: digest},
                    json={
                        "full_name": "Ravi Rao",
                        "mobile_number": "9876543211",
                        "email": "ravi@example.com",
                        "type_of_residence": "rented",
                        "employment_status_code": "self_employed",
                        "role": role,
                        "expected_lock_version": intent.json()["lock_version"],
                    },
                )
                self.assertEqual(status_code, response.status_code, response.text)
                row = asyncio.run(
                    _fetchrow(
                        "SELECT (SELECT count(*) FROM application_parties WHERE NOT is_primary) AS parties, "
                        "(SELECT count(*) FROM application_requirements WHERE application_party_id IN "
                        " (SELECT application_party_id FROM application_parties WHERE NOT is_primary)) AS requirements"
                    )
                )
                self.assertEqual(1 if status_code == 201 else 0, row["parties"])
                self.assertEqual(expected_requirements, row["requirements"])

    def test_phase_three_identifiers_and_registrations_are_encrypted_hashed_and_masked(self) -> None:
        digest = self._create_session()
        intent = self._put_intent(digest, constitution="partnership")
        party_id = intent.json()["parties"][0]["party_id"]
        pan = self.client.put(
            f"/api/apply/applications/current/parties/{party_id}/identifiers/pan",
            headers={SESSION_HEADER: digest},
            json={"pan_number": "ABCDE1234F", "expected_lock_version": 0},
        )
        aadhaar = self.client.put(
            f"/api/apply/applications/current/parties/{party_id}/identifiers/aadhaar",
            headers={SESSION_HEADER: digest},
            json={"aadhaar_number": "123412341234", "expected_lock_version": 1},
        )
        entity_pan = self.client.put(
            "/api/apply/applications/current/entity-pan",
            headers={SESSION_HEADER: digest},
            json={"entity_pan": "AAEFN1234F", "expected_lock_version": 2},
        )
        gst = self.client.put(
            "/api/apply/applications/current/gst-registration",
            headers={SESSION_HEADER: digest},
            json={
                "gst_registered": True,
                "gstin": "27ABCDE1234F1Z5",
                "state_code": "27",
                "expected_lock_version": 3,
            },
        )

        for response in (pan, aadhaar, entity_pan, gst):
            self.assertEqual(200, response.status_code, response.text)
        snapshot_text = str(gst.json())
        for plaintext in ("ABCDE1234F", "123412341234", "AAEFN1234F", "27ABCDE1234F1Z5"):
            self.assertNotIn(plaintext, snapshot_text)
        identifiers = gst.json()["parties"][0]["identifiers"]
        self.assertEqual("ABCDE***F", identifiers["pan_masked"])
        self.assertEqual("XXXX XXXX 1234", identifiers["aadhaar_masked"])
        self.assertEqual("AAEFN***F", gst.json()["registrations"]["entity_pan_masked"])
        self.assertEqual("27**********1Z5", gst.json()["registrations"]["gstin_masked"])
        self.assertEqual("27", gst.json()["registrations"]["gst_state_code"])

        rows = asyncio.run(
            _fetch(
                "SELECT 'person' AS owner, id_type::text AS kind, value_enc, value_hash, "
                "masked_value, verification_state::text FROM person_identifiers "
                "UNION ALL SELECT 'borrower', kind::text, value_enc, value_hash, "
                "masked_value, verification_state::text FROM borrower_registrations"
            )
        )
        self.assertEqual(4, len(rows))
        self.assertEqual(
            {
                ("person", "pan"),
                ("person", "aadhaar"),
                ("borrower", "entity_pan"),
                ("borrower", "gstin"),
            },
            {(row["owner"], row["kind"]) for row in rows},
        )
        self.assertTrue(
            all(row["verification_state"] == "not_attempted" for row in rows)
        )
        self.assertTrue(all(row["value_enc"] and len(row["value_hash"]) == 32 for row in rows))
        self.assertTrue(all(b"123412341234" not in bytes(row["value_enc"]) for row in rows))

    def test_phase_three_entity_pan_constitution_and_gst_state_rules(self) -> None:
        digest = self._create_session()
        intent = self._put_intent(digest, constitution="proprietorship")
        entity_pan = self.client.put(
            "/api/apply/applications/current/entity-pan",
            headers={SESSION_HEADER: digest},
            json={"entity_pan": "ABCDE1234F", "expected_lock_version": 0},
        )
        invalid_gst = self.client.put(
            "/api/apply/applications/current/gst-registration",
            headers={SESSION_HEADER: digest},
            json={"gst_registered": True, "gstin": "27ABCDE1234F1Z5", "state_code": "29", "expected_lock_version": 0},
        )
        self.assertEqual(422, entity_pan.status_code)
        self.assertEqual(422, invalid_gst.status_code)

    def test_phase_three_stale_write_is_atomic(self) -> None:
        digest = self._create_session()
        self._put_intent(digest)
        winner = self._put_business_profile(digest, 0, business_legal_name="Winner Business")
        stale = self._put_primary_person(digest, 0, full_name="Must Not Persist")
        self.assertEqual(200, winner.status_code, winner.text)
        self.assertEqual(409, stale.status_code, stale.text)
        row = asyncio.run(_fetchrow("SELECT full_name FROM persons LIMIT 1"))
        self.assertIsNone(row["full_name"])

    def test_phase_three_added_party_updates_both_relationships_and_blocks_constitution_change(self) -> None:
        digest = self._create_session()
        intent = self._put_intent(digest, constitution="partnership")
        created = self.client.post(
            "/api/apply/applications/current/parties",
            headers={SESSION_HEADER: digest},
            json={
                "full_name": "Ravi Rao",
                "mobile_number": "9876543211",
                "email": "ravi@example.com",
                "type_of_residence": "rented",
                "employment_status_code": "self_employed",
                "role": "co_applicant",
                "ownership_pct": 25,
                "expected_lock_version": intent.json()["lock_version"],
            },
        )
        party = next(item for item in created.json()["parties"] if not item["is_primary"])
        updated = self.client.put(
            f"/api/apply/applications/current/parties/{party['party_id']}",
            headers={SESSION_HEADER: digest},
            json={
                "full_name": "Ravi Kumar Rao",
                "mobile_number": "9876543212",
                "email": "ravi.rao@example.com",
                "type_of_residence": "owned",
                "employment_status_code": "self_employed",
                "ownership_pct": 30,
                "expected_lock_version": created.json()["lock_version"],
            },
        )
        constitution_change = self._put_intent(
            digest,
            constitution="private_limited",
            expected_lock_version=updated.json()["lock_version"],
        )

        self.assertEqual(201, created.status_code, created.text)
        self.assertEqual(200, updated.status_code, updated.text)
        self.assertEqual(422, constitution_change.status_code, constitution_change.text)
        updated_party = next(
            item for item in updated.json()["parties"] if not item["is_primary"]
        )
        self.assertEqual("Ravi Kumar Rao", updated_party["full_name"])
        self.assertEqual(30.0, updated_party["ownership_pct"])
        row = asyncio.run(
            _fetchrow(
                "SELECT ap.ownership_pct AS party_pct, bp.ownership_pct AS relationship_pct, "
                "la.constitution FROM application_parties ap "
                "JOIN loan_applications la ON la.application_id = ap.application_id "
                "JOIN borrower_persons bp ON bp.person_id = ap.person_id WHERE NOT ap.is_primary"
            )
        )
        self.assertEqual(30, row["party_pct"])
        self.assertEqual(30, row["relationship_pct"])
        self.assertEqual("partnership", row["constitution"])

    def test_phase_three_request_validation_rejects_untrusted_values(self) -> None:
        digest = self._create_session()
        intent = self._put_intent(digest, constitution="partnership")
        invalid_requests = (
            (
                "/api/apply/applications/current/business-profile",
                {
                    "business_legal_name": "N",
                    "business_type_code": "invented",
                    "income_type_code": "business_income",
                    "type_of_office": "rented_office",
                    "location_tier": "tier2",
                    "business_pincode": "000000",
                    "annual_turnover_range": "10_50",
                    "gst_registered": False,
                    "expected_lock_version": 0,
                },
            ),
            (
                "/api/apply/applications/current/primary-person",
                {
                    "full_name": "A",
                    "mobile_number": "123",
                    "email": "invalid",
                    "type_of_residence": "hotel",
                    "employment_status_code": "retired",
                    "expected_lock_version": 0,
                },
            ),
            (
                "/api/apply/applications/current/gst-registration",
                {
                    "gst_registered": False,
                    "gstin": "27ABCDE1234F1Z5",
                    "state_code": "27",
                    "expected_lock_version": 0,
                },
            ),
        )
        for path, payload in invalid_requests:
            with self.subTest(path=path):
                response = self.client.put(
                    path, headers={SESSION_HEADER: digest}, json=payload
                )
                self.assertEqual(422, response.status_code, response.text)
        self.assertEqual(0, intent.json()["lock_version"])

    def test_phase_three_constitution_and_gst_transitions_purge_inapplicable_registrations(self) -> None:
        digest = self._create_session()
        intent = self._put_intent(digest, constitution="partnership")
        entity_pan = self.client.put(
            "/api/apply/applications/current/entity-pan",
            headers={SESSION_HEADER: digest},
            json={"entity_pan": "AAEFN1234F", "expected_lock_version": 0},
        )
        gst = self.client.put(
            "/api/apply/applications/current/gst-registration",
            headers={SESSION_HEADER: digest},
            json={
                "gst_registered": True,
                "gstin": "27ABCDE1234F1Z5",
                "state_code": "27",
                "expected_lock_version": 1,
            },
        )
        profile = self._put_business_profile(
            digest, gst.json()["lock_version"], gst_registered=False
        )
        changed = self._put_intent(
            digest,
            constitution="proprietorship",
            expected_lock_version=profile.json()["lock_version"],
        )

        for response in (entity_pan, gst, profile, changed):
            self.assertEqual(200, response.status_code, response.text)
        self.assertIsNone(profile.json()["registrations"]["gstin_masked"])
        self.assertIsNone(changed.json()["registrations"]["entity_pan_masked"])
        rows = asyncio.run(
            _fetch("SELECT kind::text AS kind FROM borrower_registrations")
        )
        self.assertEqual([], rows)
        self.assertEqual("proprietorship", changed.json()["values"]["constitution"])

    def test_phase_three_rejects_personal_pan_that_matches_existing_entity_pan(self) -> None:
        digest = self._create_session()
        intent = self._put_intent(digest, constitution="partnership")
        party_id = intent.json()["parties"][0]["party_id"]
        entity = self.client.put(
            "/api/apply/applications/current/entity-pan",
            headers={SESSION_HEADER: digest},
            json={"entity_pan": "ABCDE1234F", "expected_lock_version": 0},
        )
        conflicting = self.client.put(
            f"/api/apply/applications/current/parties/{party_id}/identifiers/pan",
            headers={SESSION_HEADER: digest},
            json={"pan_number": "ABCDE1234F", "expected_lock_version": 1},
        )

        self.assertEqual(200, entity.status_code, entity.text)
        self.assertEqual(422, conflicting.status_code, conflicting.text)
        self.assertNotIn("ABCDE1234F", conflicting.text)
        self.assertNotIn("entity", conflicting.text.lower())
        restored = self.client.get(
            "/api/apply/applications/current", headers={SESSION_HEADER: digest}
        )
        self.assertEqual(1, restored.json()["lock_version"])
        self.assertIsNone(restored.json()["parties"][0]["identifiers"]["pan_masked"])
        row = asyncio.run(
            _fetchrow(
                "SELECT (SELECT count(*) FROM borrower_registrations WHERE kind = 'entity_pan') AS entity_pans, "
                "(SELECT count(*) FROM person_identifiers WHERE id_type = 'pan') AS personal_pans"
            )
        )
        self.assertEqual(1, row["entity_pans"])
        self.assertEqual(0, row["personal_pans"])

    def test_phase_three_rejects_entity_pan_that_matches_any_party_personal_pan(self) -> None:
        digest = self._create_session()
        intent = self._put_intent(digest, constitution="private_limited")
        added = self.client.post(
            "/api/apply/applications/current/parties",
            headers={SESSION_HEADER: digest},
            json={
                "full_name": "Ravi Rao",
                "mobile_number": "9876543211",
                "email": "ravi@example.com",
                "type_of_residence": "owned",
                "employment_status_code": "self_employed",
                "role": "director",
                "expected_lock_version": 0,
            },
        )
        party_id = next(
            party["party_id"] for party in added.json()["parties"] if not party["is_primary"]
        )
        personal = self.client.put(
            f"/api/apply/applications/current/parties/{party_id}/identifiers/pan",
            headers={SESSION_HEADER: digest},
            json={"pan_number": "ABCDE1234F", "expected_lock_version": 1},
        )
        conflicting = self.client.put(
            "/api/apply/applications/current/entity-pan",
            headers={SESSION_HEADER: digest},
            json={"entity_pan": "ABCDE1234F", "expected_lock_version": 2},
        )

        self.assertEqual(201, added.status_code, added.text)
        self.assertEqual(200, personal.status_code, personal.text)
        self.assertEqual(422, conflicting.status_code, conflicting.text)
        self.assertNotIn("ABCDE1234F", conflicting.text)
        self.assertNotIn("personal", conflicting.text.lower())
        restored = self.client.get(
            "/api/apply/applications/current", headers={SESSION_HEADER: digest}
        )
        self.assertEqual(2, restored.json()["lock_version"])
        self.assertIsNone(restored.json()["registrations"]["entity_pan_masked"])
        row = asyncio.run(
            _fetchrow(
                "SELECT (SELECT count(*) FROM borrower_registrations WHERE kind = 'entity_pan') AS entity_pans, "
                "(SELECT count(*) FROM person_identifiers WHERE id_type = 'pan') AS personal_pans"
            )
        )
        self.assertEqual(0, row["entity_pans"])
        self.assertEqual(1, row["personal_pans"])

    def test_phase_three_accepts_distinct_personal_and_entity_pans(self) -> None:
        digest = self._create_session()
        intent = self._put_intent(digest, constitution="partnership")
        party_id = intent.json()["parties"][0]["party_id"]
        personal = self.client.put(
            f"/api/apply/applications/current/parties/{party_id}/identifiers/pan",
            headers={SESSION_HEADER: digest},
            json={"pan_number": "ABCDE1234F", "expected_lock_version": 0},
        )
        entity = self.client.put(
            "/api/apply/applications/current/entity-pan",
            headers={SESSION_HEADER: digest},
            json={"entity_pan": "AAEFN1234F", "expected_lock_version": 1},
        )

        self.assertEqual(200, personal.status_code, personal.text)
        self.assertEqual(200, entity.status_code, entity.text)
        self.assertEqual(2, entity.json()["lock_version"])
        self.assertEqual(
            "ABCDE***F", entity.json()["parties"][0]["identifiers"]["pan_masked"]
        )
        self.assertEqual(
            "AAEFN***F", entity.json()["registrations"]["entity_pan_masked"]
        )


if __name__ == "__main__":
    unittest.main()
