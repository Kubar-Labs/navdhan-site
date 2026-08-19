from __future__ import annotations

import unittest
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

from db import session


class DatabaseSessionTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        await session.close_engine()

    async def asyncTearDown(self) -> None:
        await session.close_engine()

    async def test_init_probe_and_close_lifecycle(self) -> None:
        connection = AsyncMock()
        connection_context = MagicMock()
        connection_context.__aenter__ = AsyncMock(return_value=connection)
        connection_context.__aexit__ = AsyncMock(return_value=None)
        engine = MagicMock()
        engine.connect.return_value = connection_context
        engine.dispose = AsyncMock()
        session_factory = MagicMock()

        with (
            patch(
                "db.session.create_async_engine", return_value=engine
            ) as create_engine,
            patch("db.session.async_sessionmaker", return_value=session_factory),
        ):
            session.init_engine("postgresql+asyncpg://local/test")
            await session.check_connection()
            self.assertIs(session.new_session(), session_factory.return_value)
            await session.close_engine()

        create_engine.assert_called_once()
        connection.execute.assert_awaited_once()
        engine.dispose.assert_awaited_once_with()
        with self.assertRaisesRegex(RuntimeError, "not initialized"):
            session.new_session()

    async def test_tenant_session_sets_transaction_local_context(self) -> None:
        database_session = AsyncMock()
        transaction_context = MagicMock()
        transaction_context.__aenter__ = AsyncMock()
        transaction_context.__aexit__ = AsyncMock(return_value=None)
        database_session.begin.return_value = transaction_context
        session_context = MagicMock()
        session_context.__aenter__ = AsyncMock(return_value=database_session)
        session_context.__aexit__ = AsyncMock(return_value=None)
        session_factory = MagicMock(return_value=session_context)
        tenant_id = uuid.UUID("10000000-0000-0000-0000-000000000001")

        with patch.object(session, "_SessionFactory", session_factory):
            async with session.tenant_session(tenant_id) as yielded:
                self.assertIs(database_session, yielded)

        statement, parameters = database_session.execute.await_args.args
        self.assertIn("set_config", str(statement).lower())
        self.assertEqual(str(tenant_id), parameters["tenant_id"])


if __name__ == "__main__":
    unittest.main()
