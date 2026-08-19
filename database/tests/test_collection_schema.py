from __future__ import annotations

import re
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS_DIR = PROJECT_ROOT / "database" / "migrations"

EXPECTED_TABLES = {
    "application_credit_declarations",
    "application_existing_credit_facilities",
    "application_parties",
    "application_requirement_events",
    "application_requirements",
    "application_sessions",
    "application_status_events",
    "audit_events",
    "borrower_persons",
    "borrower_registration_verifications",
    "borrower_registrations",
    "borrowers",
    "business_types",
    "checklist_versions",
    "consent_grants",
    "consent_purposes",
    "destination_field_mappings",
    "destinations",
    "document_events",
    "document_requirement_satisfactions",
    "document_requirements",
    "document_type_mime_types",
    "document_types",
    "documents",
    "employment_statuses",
    "income_types",
    "lenders",
    "loan_applications",
    "loan_products",
    "marketplace_product_offerings",
    "marketplaces",
    "offering_constitutions",
    "outbox_events",
    "person_identifiers",
    "person_kyc_verifications",
    "persons",
    "retention_classes",
    "submission_events",
    "submission_packages",
    "verification_check_types",
    "verification_checks",
    "verification_providers",
}


def migration_sql(suffix: str) -> str:
    files = sorted(MIGRATIONS_DIR.glob(f"*{suffix}.sql"))
    if not files:
        raise AssertionError(f"No {suffix} migration files found")
    return "\n".join(path.read_text(encoding="utf-8") for path in files)


def normalized(sql: str) -> str:
    return re.sub(r"\s+", " ", sql.lower()).strip()


class CollectionSchemaContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.up_sql = migration_sql(".up")
        cls.down_sql = migration_sql(".down")
        cls.normalized_up = normalized(cls.up_sql)

    def test_reference_schema_tables_are_created(self) -> None:
        created = set(
            re.findall(
                r"create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)\s*\(",
                self.normalized_up,
            )
        )
        self.assertEqual(EXPECTED_TABLES, created)

    def test_required_extensions_are_enabled(self) -> None:
        self.assertIn("create extension if not exists citext", self.normalized_up)
        self.assertIn("create extension if not exists pgcrypto", self.normalized_up)

    def test_encrypted_aadhaar_is_allowed(self) -> None:
        self.assertNotRegex(
            self.normalized_up,
            r"id_type\s*<>\s*'aadhaar'.{0,80}value_enc\s+is\s+null",
        )

    def test_person_email_lookup_hash_is_tenant_scoped_and_reversible(self) -> None:
        normalized_down = normalized(self.down_sql)
        person = re.search(
            r"create\s+table\s+persons\s*\((.*?)\);",
            self.normalized_up,
        )

        self.assertIsNotNone(person)
        self.assertRegex(person.group(1), r"\bemail_hash\s+bytea\s*,")
        self.assertIn(
            "create index persons_email_hash_idx on persons "
            "(marketplace_id, email_hash) where email_hash is not null",
            self.normalized_up,
        )
        self.assertRegex(
            self.normalized_up,
            r"alter\s+table\s+persons\s+add\s+column\s+if\s+not\s+exists\s+email_hash\s+bytea",
        )
        self.assertIn(
            "create index concurrently if not exists persons_email_hash_idx "
            "on persons (marketplace_id, email_hash) where email_hash is not null",
            self.normalized_up,
        )
        self.assertIn(
            "drop index concurrently if exists persons_email_hash_idx",
            normalized_down,
        )
        self.assertRegex(
            normalized_down,
            r"alter\s+table\s+persons\s+drop\s+column\s+if\s+exists\s+email_hash",
        )

    def test_step_one_can_create_incomplete_draft_identity_rows(self) -> None:
        borrower = re.search(
            r"create\s+table\s+borrowers\s*\((.*?)\);",
            self.normalized_up,
        )
        person = re.search(
            r"create\s+table\s+persons\s*\((.*?)\);",
            self.normalized_up,
        )
        self.assertIsNotNone(borrower)
        self.assertIsNotNone(person)
        self.assertRegex(borrower.group(1), r"\blegal_name\s+text\s*,")
        self.assertRegex(person.group(1), r"\bfull_name\s+text\s*,")

    def test_browser_session_stores_only_a_token_digest(self) -> None:
        match = re.search(
            r"create\s+table\s+(?:if\s+not\s+exists\s+)?application_sessions\s*\((.*?)\);",
            self.normalized_up,
        )
        self.assertIsNotNone(match)
        definition = match.group(1)
        self.assertRegex(definition, r"token_hash\s+bytea\s+not\s+null\s+unique")
        self.assertNotIn(" token ", f" {definition} ")
        self.assertIn("expires_at timestamptz not null", definition)
        self.assertIn("revoked_at timestamptz", definition)

    def test_materialized_requirements_snapshot_coverage_rules(self) -> None:
        match = re.search(
            r"create\s+table\s+application_requirements\s*\((.*?)\);",
            self.normalized_up,
        )
        self.assertIsNotNone(match)
        definition = match.group(1)
        self.assertIn("coverage_mode coverage_mode not null", definition)
        self.assertRegex(definition, r"min_count\s+integer\s+not\s+null")
        self.assertIn("check (min_count > 0)", definition)

    def test_tenant_tables_force_row_level_security(self) -> None:
        tenant_tables = {
            table
            for table, body in re.findall(
                r"create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)\s*\((.*?)\);",
                self.normalized_up,
            )
            if re.search(r"\bmarketplace_id\b", body)
        }
        self.assertGreater(len(tenant_tables), 20)
        for table in tenant_tables:
            with self.subTest(table=table):
                self.assertIn(
                    f"alter table {table} enable row level security",
                    self.normalized_up,
                )
                self.assertIn(
                    f"alter table {table} force row level security",
                    self.normalized_up,
                )

    def test_core_child_rows_use_tenant_scoped_foreign_keys(self) -> None:
        required_fragments = (
            "foreign key (marketplace_id, borrower_id) references borrowers (marketplace_id, borrower_id)",
            "foreign key (marketplace_id, person_id) references persons (marketplace_id, person_id)",
            "foreign key (marketplace_id, application_id) references loan_applications (marketplace_id, application_id)",
            "foreign key (marketplace_id, offering_id) references marketplace_product_offerings (marketplace_id, offering_id)",
            "foreign key (marketplace_id, checklist_version_id) references checklist_versions (marketplace_id, checklist_version_id)",
        )
        for fragment in required_fragments:
            with self.subTest(fragment=fragment):
                self.assertIn(fragment, self.normalized_up)

    def test_document_type_scope_must_match_requirement_and_upload_scope(self) -> None:
        self.assertIn(
            "foreign key (document_type_code, attaches_to) references document_types (document_type_code, attaches_to)",
            self.normalized_up,
        )

    def test_application_children_cannot_mix_applications_within_a_tenant(self) -> None:
        required_fragments = (
            "foreign key (marketplace_id, application_id, application_party_id) references application_parties (marketplace_id, application_id, application_party_id)",
            "foreign key (marketplace_id, application_id, application_requirement_id) references application_requirements (marketplace_id, application_id, application_requirement_id)",
            "foreign key (marketplace_id, application_id, document_id) references documents (marketplace_id, application_id, document_id)",
        )
        for fragment in required_fragments:
            with self.subTest(fragment=fragment):
                self.assertIn(fragment, self.normalized_up)
        declaration = re.search(
            r"create\s+table\s+application_credit_declarations\s*\((.*?)\);",
            self.normalized_up,
        )
        self.assertIsNotNone(declaration)
        self.assertIn(
            "foreign key (marketplace_id, application_id, application_party_id) references application_parties (marketplace_id, application_id, application_party_id)",
            declaration.group(1),
        )

    def test_application_product_constitution_and_offering_are_consistent(self) -> None:
        required_fragments = (
            "foreign key (marketplace_id, checklist_version_id, product_code, constitution)",
            "references checklist_versions (marketplace_id, checklist_version_id, product_code, constitution)",
            "foreign key (marketplace_id, offering_id, lender_id, product_code)",
            "references marketplace_product_offerings (marketplace_id, offering_id, lender_id, product_code)",
            "foreign key (marketplace_id, offering_id, constitution)",
            "references offering_constitutions (marketplace_id, offering_id, constitution)",
        )
        for fragment in required_fragments:
            with self.subTest(fragment=fragment):
                self.assertIn(fragment, self.normalized_up)
        self.assertGreaterEqual(
            self.normalized_up.count(
                "foreign key (document_type_code, attaches_to) references document_types (document_type_code, attaches_to)"
            ),
            2,
        )

    def test_indirect_reference_children_are_tenant_scoped(self) -> None:
        for table in ("offering_constitutions", "document_requirements"):
            match = re.search(
                rf"create\s+table\s+(?:if\s+not\s+exists\s+)?{table}\s*\((.*?)\);",
                self.normalized_up,
            )
            self.assertIsNotNone(match)
            self.assertIn("marketplace_id uuid not null", match.group(1))

    def test_partitioned_audit_log_has_a_default_partition(self) -> None:
        self.assertRegex(
            self.normalized_up,
            r"create\s+table\s+audit_events_default\s+partition\s+of\s+audit_events\s+default",
        )

    def test_down_migrations_remove_every_created_table(self) -> None:
        normalized_down = normalized(self.down_sql)
        dropped = set(
            re.findall(
                r"drop\s+table\s+(?:if\s+exists\s+)?([a-z_][a-z0-9_]*)",
                normalized_down,
            )
        )
        self.assertEqual(EXPECTED_TABLES, dropped)
        self.assertNotIn("drop extension", normalized_down)


if __name__ == "__main__":
    unittest.main()
