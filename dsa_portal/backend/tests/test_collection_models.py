from __future__ import annotations

import unittest

from db.collection_models import CollectionBase


class CollectionModelMappingTests(unittest.TestCase):
    def test_foundational_tables_are_mapped(self) -> None:
        expected = {
            "application_sessions",
            "application_parties",
            "application_requirements",
            "application_status_events",
            "borrower_persons",
            "borrower_registrations",
            "borrowers",
            "checklist_versions",
            "document_requirements",
            "loan_applications",
            "loan_products",
            "marketplaces",
            "person_identifiers",
            "persons",
        }
        self.assertEqual(expected, set(CollectionBase.metadata.tables))

    def test_models_do_not_own_schema_creation(self) -> None:
        for table in CollectionBase.metadata.tables.values():
            with self.subTest(table=table.name):
                self.assertFalse(table.info.get("create_schema", False))

    def test_checklist_mapping_is_tenant_scoped(self) -> None:
        checklist = CollectionBase.metadata.tables["checklist_versions"]
        self.assertFalse(checklist.c.marketplace_id.nullable)
        self.assertTrue(
            any(
                {column.name for column in constraint.columns}
                == {"marketplace_id", "checklist_version_id"}
                for constraint in checklist.constraints
            )
        )

    def test_application_checklist_reference_is_tenant_scoped(self) -> None:
        application = CollectionBase.metadata.tables["loan_applications"]
        composite_references = {
            tuple(column.name for column in constraint.columns)
            for constraint in application.foreign_key_constraints
        }
        self.assertIn(
            ("marketplace_id", "checklist_version_id"),
            composite_references,
        )

    def test_application_checklist_reference_pins_full_rule_scope(self) -> None:
        application = CollectionBase.metadata.tables["loan_applications"]
        composite_references = {
            tuple(column.name for column in constraint.columns)
            for constraint in application.foreign_key_constraints
        }
        self.assertIn(
            (
                "marketplace_id",
                "checklist_version_id",
                "product_code",
                "constitution",
            ),
            composite_references,
        )

    def test_step_one_identity_placeholders_are_nullable(self) -> None:
        borrower = CollectionBase.metadata.tables["borrowers"]
        person = CollectionBase.metadata.tables["persons"]
        self.assertTrue(borrower.c.legal_name.nullable)
        self.assertTrue(person.c.full_name.nullable)

    def test_phase_three_person_email_hash_is_nullable_and_tenant_indexed(self) -> None:
        person = CollectionBase.metadata.tables["persons"]

        self.assertTrue(person.c.email_hash.nullable)
        email_index = next(
            index for index in person.indexes if index.name == "persons_email_hash_idx"
        )
        self.assertEqual(
            ["marketplace_id", "email_hash"],
            [column.name for column in email_index.columns],
        )

    def test_borrower_registration_mapping_is_tenant_scoped(self) -> None:
        registration = CollectionBase.metadata.tables["borrower_registrations"]
        foreign_keys = {
            tuple(column.name for column in constraint.columns)
            for constraint in registration.foreign_key_constraints
        }

        self.assertIn(("marketplace_id", "borrower_id"), foreign_keys)
        self.assertFalse(registration.c.value_hash.nullable)
        self.assertFalse(registration.c.masked_value.nullable)
        self.assertTrue(
            any(
                {column.name for column in constraint.columns}
                == {"marketplace_id", "borrower_id", "kind", "value_hash"}
                for constraint in registration.constraints
            )
        )
        primary_index = next(
            index
            for index in registration.indexes
            if index.name == "borrower_registrations_primary_kind_uq"
        )
        self.assertTrue(primary_index.unique)
        self.assertEqual(
            ["marketplace_id", "borrower_id", "kind"],
            [column.name for column in primary_index.columns],
        )


if __name__ == "__main__":
    unittest.main()
