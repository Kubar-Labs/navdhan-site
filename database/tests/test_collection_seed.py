from __future__ import annotations

import re
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SEED_PATH = PROJECT_ROOT / "database" / "seeds" / "001_collection_flow.sql"

DOCUMENT_TYPES = {
    "aadhaar_kyc",
    "aoa",
    "balance_sheet",
    "bank_statement",
    "certificate_of_incorporation",
    "computation_of_income",
    "existing_loan_track",
    "entity_pan_card",
    "form_3cb",
    "form_3cd",
    "gst_certificate",
    "gstr_3b",
    "itr",
    "moa",
    "own_house_proof",
    "pan_card",
    "partnership_deed",
    "profit_and_loss",
    "sanction_letter",
    "shareholding_pattern",
    "trade_license",
    "vat_proof",
}


class CollectionSeedContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        if not SEED_PATH.exists():
            raise AssertionError("Collection flow seed migration is missing")
        cls.sql = SEED_PATH.read_text(encoding="utf-8")
        cls.normalized = re.sub(r"\s+", " ", cls.sql.lower())

    def test_seed_is_transactional_and_idempotent(self) -> None:
        self.assertRegex(self.normalized, r"^\s*begin\s*;")
        self.assertRegex(self.normalized, r"commit\s*;\s*$")
        self.assertIn("on conflict", self.normalized)

    def test_only_supported_constitutions_receive_checklists(self) -> None:
        for constitution in ("proprietorship", "partnership", "private_limited"):
            with self.subTest(constitution=constitution):
                self.assertIn(f"'{constitution}'", self.normalized)
        for unsupported in ("'llp'", "'individual'", "'public_limited'"):
            with self.subTest(constitution=unsupported):
                self.assertNotIn(unsupported, self.normalized)

    def test_required_document_catalogue_is_seeded(self) -> None:
        for document_type in DOCUMENT_TYPES:
            with self.subTest(document_type=document_type):
                self.assertRegex(
                    self.normalized,
                    rf"\('{re.escape(document_type)}'\s*,",
                )
        self.assertNotIn("perfios", self.normalized)

    def test_pdf_is_allowed_for_every_seeded_document_type(self) -> None:
        self.assertIn("insert into document_type_mime_types", self.normalized)
        self.assertIn("application/pdf", self.normalized)

    def test_three_checklist_versions_and_rules_are_seeded(self) -> None:
        self.assertIn("insert into checklist_versions", self.normalized)
        self.assertIn("insert into document_requirements", self.normalized)
        self.assertEqual(3, len(re.findall(r"bl — (?:proprietorship|partnership|private limited)", self.normalized)))
        self.assertIn("vintage_proof", self.normalized)
        self.assertIn("lookback_months", self.normalized)
        self.assertIn("fixed_period_start", self.normalized)

    def test_product_limits_match_the_current_frontend_contract(self) -> None:
        self.assertRegex(
            self.normalized,
            r"'business_loan'\s*,\s*'commercial'\s*,\s*'business loan'\s*,\s*false\s*,\s*500000(?:\.00)?\s*,\s*10000000(?:\.00)?\s*,\s*'inr'\s*,\s*3\s*,\s*12\s*,",
        )

    def test_current_consent_notices_are_seeded(self) -> None:
        self.assertIn("insert into consent_purposes", self.normalized)
        for purpose in (
            "privacy_policy",
            "terms_of_use",
            "credit_bureau_check",
            "communications",
        ):
            with self.subTest(purpose=purpose):
                self.assertIn(f"'{purpose}'", self.normalized)
        self.assertRegex(
            self.normalized,
            r"\('communications'\s*,.*?\sfalse\s*,\s*\d+\s*,",
        )


if __name__ == "__main__":
    unittest.main()
