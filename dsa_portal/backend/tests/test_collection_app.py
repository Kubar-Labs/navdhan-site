from __future__ import annotations

import asyncio
import base64
import os
import secrets
from pathlib import Path
import sys
import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from collection_app import LOCAL_COLLECTION_DATABASE_URL, build_collection_app


def _valid_key() -> str:
    return base64.b64encode(secrets.token_bytes(32)).decode()


class CollectionAppTests(unittest.TestCase):
    def test_health_endpoint_is_available_without_legacy_runtime(self) -> None:
        app = build_collection_app(run_database_probe=False, validate_crypto=False)

        with TestClient(app) as client:
            response = client.get("/health")

        self.assertEqual(200, response.status_code)
        self.assertEqual({"status": "ok"}, response.json())
        self.assertNotIn("services.perfios", sys.modules)

    def test_collection_runtime_exposes_collection_routes_only(self) -> None:
        app = build_collection_app(run_database_probe=False, validate_crypto=False)

        paths = set(app.openapi()["paths"])

        self.assertIn("/api/apply/session", paths)
        self.assertIn("/api/apply/applications/current/business-profile", paths)
        self.assertIn("/api/apply/applications/current/primary-person", paths)
        self.assertIn("/api/apply/applications/current/parties", paths)
        self.assertNotIn("/api/v1/aadhaar", paths)
        self.assertNotIn("/api/v1/pan", paths)
        self.assertNotIn("services.perfios", sys.modules)

    def test_container_starts_the_collection_runtime_on_the_local_port(self) -> None:
        dockerfile = Path(__file__).resolve().parents[1] / "Dockerfile"
        contents = dockerfile.read_text(encoding="utf-8")

        self.assertIn('"uvicorn", "collection_app:app"', contents)
        self.assertIn('"--port", "8000"', contents)
        self.assertIn("EXPOSE 8000", contents)
        self.assertNotIn('"main:app"', contents)

    def test_main_module_is_a_thin_collection_runtime_alias(self) -> None:
        main_module = Path(__file__).resolve().parents[1] / "main.py"
        contents = main_module.read_text(encoding="utf-8")

        self.assertIn("from collection_app import app", contents)
        self.assertNotIn("from routes import", contents)
        self.assertNotIn("services.perfios", contents)

    def test_startup_accepts_an_isolated_database_location_and_probes_it(self) -> None:
        database_location = "postgresql+asyncpg://postgres@127.0.0.1:55432/postgres"

        with (
            patch("db.session.init_engine") as init_engine,
            patch("db.session.check_connection", new_callable=AsyncMock) as check_connection,
            patch("db.session.close_engine", new_callable=AsyncMock),
        ):
            app = build_collection_app(database_url=database_location, validate_crypto=False)
            with TestClient(app) as client:
                response = client.get("/health")

        self.assertEqual(200, response.status_code)
        init_engine.assert_called_once_with(database_location)
        check_connection.assert_awaited_once_with()

    def test_startup_closes_database_state_when_probe_fails(self) -> None:
        with (
            patch("db.session.init_engine"),
            patch(
                "db.session.check_connection",
                new_callable=AsyncMock,
                side_effect=RuntimeError("probe failed"),
            ),
            patch("db.session.close_engine", new_callable=AsyncMock) as close_engine,
        ):
            app = build_collection_app(
                database_url="postgresql+asyncpg://local/test", validate_crypto=False
            )

            async def start_app() -> None:
                async with app.router.lifespan_context(app):
                    pass

            with self.assertRaisesRegex(RuntimeError, "probe failed"):
                asyncio.run(start_app())

        close_engine.assert_awaited_once_with()

    def test_default_collection_app_uses_its_isolated_local_database(self) -> None:
        with (
            patch("db.session.init_engine") as init_engine,
            patch("db.session.check_connection", new_callable=AsyncMock),
            patch("db.session.close_engine", new_callable=AsyncMock),
        ):
            app = build_collection_app(validate_crypto=False)
            with TestClient(app):
                pass

        init_engine.assert_called_once_with(LOCAL_COLLECTION_DATABASE_URL)


class CollectionAppCryptoStartupTests(unittest.TestCase):
    def setUp(self) -> None:
        self._previous_encryption_key = os.environ.get("ENCRYPTION_KEY")
        self._previous_lookup_key = os.environ.get("LOOKUP_HMAC_KEY")

    def tearDown(self) -> None:
        for name, prior in (
            ("ENCRYPTION_KEY", self._previous_encryption_key),
            ("LOOKUP_HMAC_KEY", self._previous_lookup_key),
        ):
            if prior is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = prior
        from security import crypto

        crypto._cached_key = None

    def _start(self) -> None:
        app = build_collection_app(run_database_probe=False)
        with TestClient(app):
            pass

    def test_startup_fails_clearly_when_encryption_key_is_missing(self) -> None:
        os.environ.pop("ENCRYPTION_KEY", None)
        os.environ["LOOKUP_HMAC_KEY"] = _valid_key()
        from security import crypto

        crypto._cached_key = None

        with self.assertRaisesRegex(RuntimeError, "ENCRYPTION_KEY"):
            self._start()

    def test_startup_fails_clearly_when_encryption_key_is_the_wrong_length(self) -> None:
        os.environ["ENCRYPTION_KEY"] = base64.b64encode(secrets.token_bytes(16)).decode()
        os.environ["LOOKUP_HMAC_KEY"] = _valid_key()
        from security import crypto

        crypto._cached_key = None

        with self.assertRaisesRegex(RuntimeError, "ENCRYPTION_KEY"):
            self._start()

    def test_startup_fails_clearly_when_lookup_hmac_key_is_missing(self) -> None:
        os.environ["ENCRYPTION_KEY"] = _valid_key()
        os.environ.pop("LOOKUP_HMAC_KEY", None)

        with self.assertRaisesRegex(RuntimeError, "LOOKUP_HMAC_KEY"):
            self._start()

    def test_startup_fails_clearly_when_lookup_hmac_key_is_too_short(self) -> None:
        os.environ["ENCRYPTION_KEY"] = _valid_key()
        os.environ["LOOKUP_HMAC_KEY"] = base64.b64encode(secrets.token_bytes(8)).decode()

        with self.assertRaisesRegex(RuntimeError, "LOOKUP_HMAC_KEY"):
            self._start()

    def test_startup_succeeds_when_both_crypto_keys_are_valid(self) -> None:
        os.environ["ENCRYPTION_KEY"] = _valid_key()
        os.environ["LOOKUP_HMAC_KEY"] = _valid_key()
        from security import crypto

        crypto._cached_key = None

        app = build_collection_app(run_database_probe=False)
        with TestClient(app) as client:
            response = client.get("/health")

        self.assertEqual(200, response.status_code)


if __name__ == "__main__":
    unittest.main()
