from __future__ import annotations

import re
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
UP = (PROJECT_ROOT / "database/migrations/005_application_retention.up.sql").read_text(
    encoding="utf-8"
)
DOWN = (
    PROJECT_ROOT / "database/migrations/005_application_retention.down.sql"
).read_text(encoding="utf-8")


def normalized(value: str) -> str:
    return re.sub(r"\s+", " ", value.lower()).strip()


class RetentionMigrationTests(unittest.TestCase):
    def test_adds_reversible_purge_marker_and_candidate_index(self) -> None:
        up = normalized(UP)
        down = normalized(DOWN)
        self.assertIn(
            "add column if not exists retention_purged_at timestamptz", up
        )
        self.assertIn(
            "where retention_purged_at is null", up
        )
        self.assertIn(
            "drop column if exists retention_purged_at", down
        )
        self.assertIn(
            "drop index if exists loan_applications_retention_candidates_idx", down
        )


if __name__ == "__main__":
    unittest.main()
