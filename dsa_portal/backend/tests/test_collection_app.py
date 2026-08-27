from __future__ import annotations

import asyncio
import base64
import os
import secrets
from pathlib import Path
import sys
import unittest
from unittest.mock import AsyncMock, patch

from httpx import ASGITransport, AsyncClient

from collection_app import build_collection_app
from settings import ConfigurationError, load_settings


SERVICE_TOKEN = "test-backend-service-token-32-bytes-minimum"
SERVICE_TOKEN_HEADER = "x-navdhan-service-token"
SCAN_CALLBACK_TOKEN = "test-document-scan-callback-token-32-bytes"
SCAN_CALLBACK_TOKEN_HEADER = "x-navdhan-scan-token"
DEPLOYED_STORAGE = {
    "GCS_BUCKET": "navdhan-documents-test",
    "GOOGLE_CLOUD_PROJECT": "navdhan-test-project",
}


def _valid_key() -> str:
    return base64.b64encode(secrets.token_bytes(32)).decode()


class CollectionAppTests(unittest.TestCase):
    def test_health_endpoint_is_available_without_legacy_runtime(self) -> None:
        app = build_collection_app(run_database_probe=False, validate_crypto=False)

        async def request_health():
            async with app.router.lifespan_context(app):
                async with AsyncClient(
                    transport=ASGITransport(app=app), base_url="http://test"
                ) as client:
                    return await client.get("/health")

        response = asyncio.run(request_health())

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

        self.assertIn("uvicorn collection_app:app", contents)
        # The port must come from the environment: Cloud Run injects $PORT and
        # a container pinned to 8000 never passes its health check.
        self.assertIn("${PORT:-8000}", contents)
        self.assertIn("${HOST:-0.0.0.0}", contents)
        self.assertNotIn('"--port", "8000"', contents)
        self.assertNotIn("main:app", contents)

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
            patch(
                "db.session.check_connection", new_callable=AsyncMock
            ) as check_connection,
            patch("db.session.close_engine", new_callable=AsyncMock),
        ):
            app = build_collection_app(
                database_url=database_location, validate_crypto=False
            )
            async def request_health():
                async with app.router.lifespan_context(app):
                    async with AsyncClient(
                        transport=ASGITransport(app=app), base_url="http://test"
                    ) as client:
                        return await client.get("/health")

            response = asyncio.run(request_health())

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

    def test_default_collection_app_uses_the_environment_database_url(self) -> None:
        configured = "postgresql+asyncpg://postgres@127.0.0.1:55432/navdhan_env_probe"

        with (
            patch.dict(os.environ, {"DATABASE_URL": configured}),
            patch("db.session.init_engine") as init_engine,
            patch("db.session.check_connection", new_callable=AsyncMock),
            patch("db.session.close_engine", new_callable=AsyncMock),
        ):
            app = build_collection_app(validate_crypto=False)
            async def start_app() -> None:
                async with app.router.lifespan_context(app):
                    pass

            asyncio.run(start_app())

        init_engine.assert_called_once_with(configured)

    def test_startup_fails_fast_when_database_url_is_unset(self) -> None:
        """No hard-coded fallback: a deployed container must not silently dial
        its own loopback when DATABASE_URL is missing."""
        with (
            patch.dict(os.environ),
            patch("db.session.init_engine") as init_engine,
            patch("db.session.check_connection", new_callable=AsyncMock),
            patch("db.session.close_engine", new_callable=AsyncMock),
        ):
            for name in ("DATABASE_URL", "DB_HOST", "DB_USER", "DB_NAME"):
                os.environ.pop(name, None)
            app = build_collection_app(validate_crypto=False)

            with self.assertRaisesRegex(RuntimeError, "DATABASE_URL is not set"):

                async def start_app() -> None:
                    async with app.router.lifespan_context(app):
                        pass

                asyncio.run(start_app())

        init_engine.assert_not_called()


class CollectionAppServiceAuthenticationTests(unittest.IsolatedAsyncioTestCase):
    def _app(self):
        with patch.dict(
            os.environ,
            {"APP_ENV": "dev", "APPLY_SERVICE_TOKEN": SERVICE_TOKEN},
            clear=True,
        ):
            return build_collection_app(
                run_database_probe=False,
                validate_crypto=False,
            )

    async def test_health_remains_public_but_every_apply_route_requires_service_token(
        self,
    ) -> None:
        app = self._app()

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            health = await client.get("/health")
            missing = await client.post("/api/apply/session", json={})
            unauthenticated_preflight = await client.options(
                "/api/apply/session",
                headers={
                    "origin": "https://navdhan.app",
                    "access-control-request-method": "POST",
                },
            )
            incorrect = await client.post(
                "/api/apply/session",
                headers={
                    SERVICE_TOKEN_HEADER: "incorrect-token-that-is-at-least-32-bytes"
                },
                json={},
            )
            authenticated = await client.post(
                "/api/apply/session",
                headers={SERVICE_TOKEN_HEADER: SERVICE_TOKEN},
                json={},
            )

        self.assertEqual(200, health.status_code)
        self.assertEqual(401, missing.status_code)
        self.assertEqual(401, unauthenticated_preflight.status_code)
        self.assertEqual(401, incorrect.status_code)
        # Authentication ran before FastAPI request validation. Once the
        # service token is valid, the deliberately empty payload reaches the
        # route and is rejected as malformed.
        self.assertEqual(422, authenticated.status_code)

    async def test_service_token_comparison_uses_constant_time_primitive(
        self,
    ) -> None:
        app = self._app()

        with patch(
            "collection_app.secrets.compare_digest", return_value=False
        ) as compare_digest:
            async with AsyncClient(
                transport=ASGITransport(app=app),
                base_url="http://test",
            ) as client:
                response = await client.get(
                    "/api/apply/not-a-real-route",
                    headers={
                        SERVICE_TOKEN_HEADER: "candidate-token-that-is-at-least-32-bytes"
                    },
                )

        self.assertEqual(401, response.status_code)
        compare_digest.assert_called_once_with(
            b"candidate-token-that-is-at-least-32-bytes",
            SERVICE_TOKEN.encode("utf-8"),
        )

    async def test_unconfigured_development_app_fails_closed_for_apply_routes(
        self,
    ) -> None:
        with patch.dict(os.environ, {"APP_ENV": "dev"}, clear=True):
            app = build_collection_app(run_database_probe=False, validate_crypto=False)

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            response = await client.post("/api/apply/session", json={})

        self.assertEqual(503, response.status_code)
        self.assertEqual({"detail": "Service unavailable"}, response.json())

    async def test_scan_callback_uses_a_distinct_fail_closed_service_token(
        self,
    ) -> None:
        with patch.dict(
            os.environ,
            {
                "APP_ENV": "dev",
                "APPLY_SERVICE_TOKEN": SERVICE_TOKEN,
                "DOCUMENT_SCAN_CALLBACK_TOKEN": SCAN_CALLBACK_TOKEN,
            },
            clear=True,
        ):
            app = build_collection_app(run_database_probe=False, validate_crypto=False)

        path = "/internal/document-scans/10000000-0000-4000-8000-000000000001/result"
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            missing = await client.post(path, json={})
            unknown_internal = await client.get("/internal/not-a-real-route")
            apply_token = await client.post(
                path,
                headers={SCAN_CALLBACK_TOKEN_HEADER: SERVICE_TOKEN},
                json={},
            )
            scanner_token = await client.post(
                path,
                headers={SCAN_CALLBACK_TOKEN_HEADER: SCAN_CALLBACK_TOKEN},
                json={},
            )

        self.assertEqual(401, missing.status_code)
        self.assertEqual(401, unknown_internal.status_code)
        self.assertEqual(401, apply_token.status_code)
        # The correct scanner credential reaches request validation; an empty
        # callback payload is deliberately invalid.
        self.assertEqual(422, scanner_token.status_code)

    async def test_unconfigured_scan_callback_is_unavailable(self) -> None:
        app = self._app()
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            response = await client.post(
                "/internal/document-scans/10000000-0000-4000-8000-000000000001/result",
                headers={SCAN_CALLBACK_TOKEN_HEADER: SCAN_CALLBACK_TOKEN},
                json={},
            )

        self.assertEqual(503, response.status_code)


class CollectionAppProductionSettingsTests(unittest.TestCase):
    def test_defaults_to_info_logging(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            settings = load_settings()

        self.assertEqual("INFO", settings.log_level)

    def test_production_rejects_missing_or_weak_service_tokens(self) -> None:
        with patch.dict(os.environ, {"APP_ENV": "prod"}, clear=True):
            with self.assertRaisesRegex(ConfigurationError, "APPLY_SERVICE_TOKEN"):
                load_settings()

        with patch.dict(
            os.environ,
            {
                "APP_ENV": "production",
                "APPLY_SERVICE_TOKEN": "too-short",
                "DOCUMENT_SCAN_CALLBACK_TOKEN": SCAN_CALLBACK_TOKEN,
            },
            clear=True,
        ):
            with self.assertRaisesRegex(ConfigurationError, "at least 32 bytes"):
                load_settings()

        with patch.dict(
            os.environ,
            {
                "APP_ENV": "dev",
                "DOCUMENT_SCAN_CALLBACK_TOKEN": "too-short",
            },
            clear=True,
        ):
            with self.assertRaisesRegex(
                ConfigurationError, "DOCUMENT_SCAN_CALLBACK_TOKEN"
            ):
                load_settings()

        with patch.dict(
            os.environ,
            {"APP_ENV": "prod", "APPLY_SERVICE_TOKEN": SERVICE_TOKEN},
            clear=True,
        ):
            with self.assertRaisesRegex(
                ConfigurationError, "DOCUMENT_SCAN_CALLBACK_TOKEN"
            ):
                load_settings()

        with patch.dict(
            os.environ,
            {
                "APP_ENV": "prod",
                "APPLY_SERVICE_TOKEN": SERVICE_TOKEN,
                "DOCUMENT_SCAN_CALLBACK_TOKEN": SERVICE_TOKEN,
            },
            clear=True,
        ):
            with self.assertRaisesRegex(ConfigurationError, "must be distinct"):
                load_settings()

        with patch.dict(os.environ, {"APP_ENV": "staging"}, clear=True):
            with self.assertRaisesRegex(ConfigurationError, "APPLY_SERVICE_TOKEN"):
                load_settings()

        with patch.dict(
            os.environ,
            {"APP_ENV": "staging", "APPLY_SERVICE_TOKEN": SERVICE_TOKEN},
            clear=True,
        ):
            with self.assertRaisesRegex(
                ConfigurationError, "DOCUMENT_SCAN_CALLBACK_TOKEN"
            ):
                load_settings()

    def test_production_never_uses_wildcard_cors(self) -> None:
        with patch.dict(
            os.environ,
            {
                "APP_ENV": "prod",
                "APPLY_SERVICE_TOKEN": SERVICE_TOKEN,
                "DOCUMENT_SCAN_CALLBACK_TOKEN": SCAN_CALLBACK_TOKEN,
                **DEPLOYED_STORAGE,
            },
            clear=True,
        ):
            settings = load_settings()

        self.assertEqual([], settings.allowed_origins)

        with patch.dict(
            os.environ,
            {
                "APP_ENV": "prod",
                "APPLY_SERVICE_TOKEN": SERVICE_TOKEN,
                "DOCUMENT_SCAN_CALLBACK_TOKEN": SCAN_CALLBACK_TOKEN,
                "ALLOWED_ORIGINS": "https://navdhan.app,*",
                **DEPLOYED_STORAGE,
            },
            clear=True,
        ):
            with self.assertRaisesRegex(ConfigurationError, "wildcard"):
                load_settings()

    def test_production_disables_public_api_documentation(self) -> None:
        with patch.dict(
            os.environ,
            {
                "APP_ENV": "prod",
                "APPLY_SERVICE_TOKEN": SERVICE_TOKEN,
                "DOCUMENT_SCAN_CALLBACK_TOKEN": SCAN_CALLBACK_TOKEN,
                **DEPLOYED_STORAGE,
            },
            clear=True,
        ):
            app = build_collection_app(
                run_database_probe=False,
                validate_crypto=False,
            )

        self.assertIsNone(app.docs_url)
        self.assertIsNone(app.redoc_url)
        self.assertIsNone(app.openapi_url)

        with patch.dict(
            os.environ,
            {
                "APP_ENV": "staging",
                "APPLY_SERVICE_TOKEN": SERVICE_TOKEN,
                "DOCUMENT_SCAN_CALLBACK_TOKEN": SCAN_CALLBACK_TOKEN,
                **DEPLOYED_STORAGE,
            },
            clear=True,
        ):
            staging_app = build_collection_app(
                run_database_probe=False,
                validate_crypto=False,
            )
        self.assertIsNone(staging_app.docs_url)
        self.assertIsNone(staging_app.redoc_url)
        self.assertIsNone(staging_app.openapi_url)

    def test_app_environment_and_deployed_storage_fail_closed(self) -> None:
        with patch.dict(os.environ, {"APP_ENV": "prodcution"}, clear=True):
            with self.assertRaisesRegex(ConfigurationError, "APP_ENV must be one of"):
                load_settings()

        credentials = {
            "APP_ENV": "prod",
            "APPLY_SERVICE_TOKEN": SERVICE_TOKEN,
            "DOCUMENT_SCAN_CALLBACK_TOKEN": SCAN_CALLBACK_TOKEN,
        }
        with patch.dict(os.environ, credentials, clear=True):
            with self.assertRaisesRegex(ConfigurationError, "GCS_BUCKET"):
                load_settings()

        with patch.dict(
            os.environ,
            {**credentials, "GCS_BUCKET": "navdhan-documents-test"},
            clear=True,
        ):
            with self.assertRaisesRegex(ConfigurationError, "GOOGLE_CLOUD_PROJECT"):
                load_settings()


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

        async def start_app() -> None:
            async with app.router.lifespan_context(app):
                pass

        asyncio.run(start_app())

    def test_startup_fails_clearly_when_encryption_key_is_missing(self) -> None:
        os.environ.pop("ENCRYPTION_KEY", None)
        os.environ["LOOKUP_HMAC_KEY"] = _valid_key()
        from security import crypto

        crypto._cached_key = None

        with self.assertRaisesRegex(RuntimeError, "ENCRYPTION_KEY"):
            self._start()

    def test_startup_fails_clearly_when_encryption_key_is_the_wrong_length(
        self,
    ) -> None:
        os.environ["ENCRYPTION_KEY"] = base64.b64encode(
            secrets.token_bytes(16)
        ).decode()
        os.environ["LOOKUP_HMAC_KEY"] = _valid_key()
        from security import crypto

        crypto._cached_key = None

        with self.assertRaisesRegex(RuntimeError, "ENCRYPTION_KEY"):
            self._start()

    def test_startup_rejects_non_base64_encryption_key_material(self) -> None:
        os.environ["ENCRYPTION_KEY"] = "!" * 44
        os.environ["LOOKUP_HMAC_KEY"] = _valid_key()
        from security import crypto

        crypto._cached_key = None

        with self.assertRaisesRegex(RuntimeError, "valid base64"):
            crypto.require_key()

    def test_startup_fails_clearly_when_lookup_hmac_key_is_missing(self) -> None:
        os.environ["ENCRYPTION_KEY"] = _valid_key()
        os.environ.pop("LOOKUP_HMAC_KEY", None)

        with self.assertRaisesRegex(RuntimeError, "LOOKUP_HMAC_KEY"):
            self._start()

    def test_startup_fails_clearly_when_lookup_hmac_key_is_too_short(self) -> None:
        os.environ["ENCRYPTION_KEY"] = _valid_key()
        os.environ["LOOKUP_HMAC_KEY"] = base64.b64encode(
            secrets.token_bytes(8)
        ).decode()

        with self.assertRaisesRegex(RuntimeError, "LOOKUP_HMAC_KEY"):
            self._start()

    def test_startup_succeeds_when_both_crypto_keys_are_valid(self) -> None:
        os.environ["ENCRYPTION_KEY"] = _valid_key()
        os.environ["LOOKUP_HMAC_KEY"] = _valid_key()
        from security import crypto

        crypto._cached_key = None

        app = build_collection_app(run_database_probe=False)

        async def start_and_request():
            async with app.router.lifespan_context(app):
                async with AsyncClient(
                    transport=ASGITransport(app=app),
                    base_url="http://test",
                ) as client:
                    return await client.get("/health")

        response = asyncio.run(start_and_request())

        self.assertEqual(200, response.status_code)


if __name__ == "__main__":
    unittest.main()
