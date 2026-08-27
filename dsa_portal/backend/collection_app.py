"""Minimal FastAPI application for the collection-only backend."""

from __future__ import annotations

import secrets
from contextlib import asynccontextmanager
from typing import AsyncIterator

from dotenv import load_dotenv
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.datastructures import Headers
from starlette.types import ASGIApp, Receive, Scope, Send

from settings import configure_logging, load_settings, resolve_database_url

# Load .env independently of the legacy config.py so ENCRYPTION_KEY /
# LOOKUP_HMAC_KEY / DATABASE_URL reach this process however it is started
# (uvicorn collection_app:app, main.py, or the Docker entrypoint), without
# pulling in legacy Perfios-only configuration. override=False (the default)
# so a checked-in/local .env only fills gaps and never clobbers an explicitly
# supplied runtime/Docker environment variable of the same name -- which is how
# a Secret Manager-injected value wins over anything baked into an image.
load_dotenv()

SERVICE_TOKEN_HEADER = "x-navdhan-service-token"
SCAN_CALLBACK_TOKEN_HEADER = "x-navdhan-scan-token"


class ServiceBoundaryMiddleware:
    """Authenticate public portal calls and scanner callbacks independently."""

    def __init__(
        self,
        app: ASGIApp,
        *,
        service_token: str | None,
        document_scan_callback_token: str | None,
    ) -> None:
        self.app = app
        self.service_token = service_token.encode("utf-8") if service_token else None
        self.document_scan_callback_token = (
            document_scan_callback_token.encode("utf-8")
            if document_scan_callback_token
            else None
        )

    async def _authenticate(
        self,
        scope: Scope,
        receive: Receive,
        send: Send,
        *,
        header_name: str,
        expected_token: bytes | None,
    ) -> bool:
        if expected_token is None:
            response = JSONResponse(
                {"detail": "Service unavailable"},
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
            await response(scope, receive, send)
            return False
        supplied_token = Headers(scope=scope).get(header_name)
        if supplied_token is None or not secrets.compare_digest(
            supplied_token.encode("utf-8"), expected_token
        ):
            response = JSONResponse(
                {"detail": "Unauthorized"},
                status_code=status.HTTP_401_UNAUTHORIZED,
            )
            await response(scope, receive, send)
            return False
        return True

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = str(scope.get("path", ""))
        is_apply_route = path == "/api/apply" or path.startswith("/api/apply/")
        # Reserve the entire internal namespace for independently
        # authenticated machine callbacks so a future internal router cannot
        # accidentally become public merely by using a different subpath.
        is_scan_callback = path == "/internal" or path.startswith("/internal/")
        if is_apply_route and not await self._authenticate(
            scope,
            receive,
            send,
            header_name=SERVICE_TOKEN_HEADER,
            expected_token=self.service_token,
        ):
            return
        if is_scan_callback and not await self._authenticate(
            scope,
            receive,
            send,
            header_name=SCAN_CALLBACK_TOKEN_HEADER,
            expected_token=self.document_scan_callback_token,
        ):
            return

        await self.app(scope, receive, send)


def require_database_url() -> str:
    """Backwards-compatible alias for `settings.resolve_database_url`."""
    return resolve_database_url()


def build_collection_app(
    *,
    database_url: str | None = None,
    run_database_probe: bool = True,
    validate_crypto: bool = True,
) -> FastAPI:
    """Build the collection app without importing the legacy API runtime."""

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        if validate_crypto:
            # Fail startup clearly if PII encryption/lookup-hash keys are
            # missing or malformed, instead of a 500 on the first encrypted
            # write (e.g. the primary-person save).
            from security.crypto import require_key
            from security.lookup_hash import load_lookup_key

            require_key()
            load_lookup_key()

        if not run_database_probe:
            yield
            return

        # Keep database configuration lazy so importing this module remains
        # independent of the legacy verification application's runtime.
        from db.session import check_connection, close_engine, init_engine

        collection_database_url = database_url or require_database_url()
        init_engine(collection_database_url)
        try:
            await check_connection()
            yield
        finally:
            await close_engine()

    settings = load_settings()
    # An environment variable alone can never activate an unreviewed adapter.
    from providers import get_verification_provider

    get_verification_provider(settings.verification_provider_mode)
    configure_logging(settings.log_level)

    collection_app = FastAPI(
        title="Navdhan Collection API",
        version="1.0.0",
        lifespan=lifespan,
        docs_url=None if settings.is_deployed else "/docs",
        redoc_url=None if settings.is_deployed else "/redoc",
        openapi_url=None if settings.is_deployed else "/openapi.json",
    )

    # The browser never calls this service directly (Next proxies it
    # server-side), so CORS is belt-and-braces rather than the access control.
    # allow_credentials stays False: this API carries no cookies -- the session
    # digest is a custom header -- and "*" with credentials is rejected by
    # browsers anyway. Real access control is service-to-service auth.
    collection_app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Add this after CORS so it is the outer middleware and even preflight
    # requests under /api/apply cannot bypass service authentication.
    collection_app.add_middleware(
        ServiceBoundaryMiddleware,
        service_token=settings.service_token,
        document_scan_callback_token=settings.document_scan_callback_token,
    )

    from routes.collection_application import router as collection_application_router
    from routes.collection_requirements import (
        internal_router as collection_internal_router,
        router as collection_requirements_router,
    )
    from routes.collection_submission import router as collection_submission_router

    collection_app.include_router(collection_application_router)
    collection_app.include_router(collection_requirements_router)
    collection_app.include_router(collection_internal_router)
    collection_app.include_router(collection_submission_router)

    @collection_app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return collection_app


app = build_collection_app()
