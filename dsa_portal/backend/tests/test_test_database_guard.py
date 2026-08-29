"""Proves the destructive-test-cleanup guard refuses to run against the dev DB."""

from __future__ import annotations

import asyncio
import unittest
from unittest.mock import AsyncMock, patch

from tests import db_test_support
from tests.db_test_support import (
    UnsafeTestDatabaseError,
    guard_live_connection_is_test_database,
    guard_test_database_name,
)


DEV_DSN = "postgresql://postgres@127.0.0.1:55432/navdhan_dev"


class TestDatabaseGuardTests(unittest.TestCase):
    def setUp(self) -> None:
        self._previous_dsn = db_test_support.TEST_PG_DSN

    def tearDown(self) -> None:
        db_test_support.TEST_PG_DSN = self._previous_dsn

    def test_guard_accepts_the_configured_dedicated_test_database(self) -> None:
        db_test_support.TEST_PG_DSN = (
            "postgresql://postgres@127.0.0.1:55432/navdhan_test"
        )
        self.assertEqual("navdhan_test", guard_test_database_name())

    def test_guard_refuses_when_configured_database_name_is_the_dev_database(
        self,
    ) -> None:
        db_test_support.TEST_PG_DSN = DEV_DSN

        with patch.object(db_test_support, "DEV_DATABASE_NAME", "navdhan_dev"):
            with self.assertRaisesRegex(
                UnsafeTestDatabaseError, "development database"
            ):
                guard_test_database_name()

    def test_guard_refuses_a_database_name_without_the_test_suffix(self) -> None:
        db_test_support.TEST_PG_DSN = (
            "postgresql://postgres@127.0.0.1:55432/navdhan_staging"
        )

        with self.assertRaisesRegex(UnsafeTestDatabaseError, "_test"):
            guard_test_database_name()

    def test_guard_refuses_a_live_connection_to_the_dev_database(self) -> None:
        db_test_support.TEST_PG_DSN = DEV_DSN

        async def probe() -> None:
            connection = AsyncMock()
            connection.fetchval.return_value = "navdhan_dev"
            with patch.object(db_test_support, "DEV_DATABASE_NAME", "navdhan_dev"):
                with self.assertRaises(UnsafeTestDatabaseError):
                    await guard_live_connection_is_test_database(connection)

        asyncio.run(probe())

    def test_guard_refuses_when_live_connection_disagrees_with_configured_name(
        self,
    ) -> None:
        # Configured name looks safe, but the live connection is actually the
        # dev database — defense in depth against DSN/host drift.
        db_test_support.TEST_PG_DSN = (
            "postgresql://postgres@127.0.0.1:55432/navdhan_test"
        )

        async def probe() -> None:
            connection = AsyncMock()
            connection.fetchval.return_value = "navdhan_dev"
            with patch.object(db_test_support, "DEV_DATABASE_NAME", "navdhan_dev"):
                with self.assertRaises(UnsafeTestDatabaseError):
                    await guard_live_connection_is_test_database(connection)

        asyncio.run(probe())


if __name__ == "__main__":
    unittest.main()
