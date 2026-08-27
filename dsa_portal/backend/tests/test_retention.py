from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone

from dateutil.relativedelta import relativedelta

from maintenance.retention import (
    ApplicationRetentionState,
    DRAFT_RETENTION_DAYS,
    SUBMITTED_RETENTION_MONTHS,
    is_retention_due,
    retention_cutoffs,
)


class RetentionPolicyTests(unittest.TestCase):
    NOW = datetime(2026, 8, 28, 12, 0, tzinfo=timezone.utc)

    def test_cutoffs_are_30_days_and_60_calendar_months(self) -> None:
        draft, submitted = retention_cutoffs(self.NOW)
        self.assertEqual(self.NOW - timedelta(days=DRAFT_RETENTION_DAYS), draft)
        self.assertEqual(
            self.NOW - relativedelta(months=SUBMITTED_RETENTION_MONTHS), submitted
        )

    def test_draft_is_due_at_30_days_but_not_before(self) -> None:
        due = ApplicationRetentionState(
            status="in_progress",
            updated_at=self.NOW - timedelta(days=30),
            submitted_at=None,
        )
        fresh = ApplicationRetentionState(
            status="in_progress",
            updated_at=self.NOW - timedelta(days=29, hours=23),
            submitted_at=None,
        )
        self.assertTrue(is_retention_due(due, now=self.NOW))
        self.assertFalse(is_retention_due(fresh, now=self.NOW))

    def test_submitted_is_due_at_60_calendar_months_but_not_before(self) -> None:
        cutoff = self.NOW - relativedelta(months=60)
        due = ApplicationRetentionState(
            status="submitted",
            updated_at=self.NOW,
            submitted_at=cutoff,
        )
        fresh = ApplicationRetentionState(
            status="submitted",
            updated_at=self.NOW,
            submitted_at=cutoff + timedelta(seconds=1),
        )
        self.assertTrue(is_retention_due(due, now=self.NOW))
        self.assertFalse(is_retention_due(fresh, now=self.NOW))

    def test_already_purged_records_are_never_selected_again(self) -> None:
        state = ApplicationRetentionState(
            status="expired",
            updated_at=self.NOW - timedelta(days=365),
            submitted_at=None,
            retention_purged_at=self.NOW - timedelta(days=1),
        )
        self.assertFalse(is_retention_due(state, now=self.NOW))

    def test_naive_clock_is_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "timezone-aware"):
            retention_cutoffs(datetime(2026, 8, 28, 12, 0))


if __name__ == "__main__":
    unittest.main()
