from __future__ import annotations

from pathlib import Path
import unittest


MIGRATION = (
    Path(__file__).resolve().parents[1]
    / "migrations"
    / "004_document_scan_quarantine.up.sql"
)


class DocumentQuarantineMigrationTests(unittest.TestCase):
    def test_forward_migration_adds_quarantine_and_integrity_fields(self) -> None:
        sql = MIGRATION.read_text(encoding="utf-8").lower()

        self.assertIn("add value if not exists 'quarantined'", sql)
        self.assertIn("uploaded_for_requirement_id", sql)
        self.assertIn("scan_job_id", sql)
        self.assertIn("scan_completed_at", sql)
        self.assertIn("document_scan_state_check", sql)
        self.assertIn("scan_result = 'clean'", sql)
        self.assertIn("unlinked_at", sql)


if __name__ == "__main__":
    unittest.main()
