"""Minimal FastAPI application for the collection-only backend."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from settings import configure_logging, load_settings, resolve_database_url

# Load .env independently of the legacy config.py so ENCRYPTION_KEY /
# LOOKUP_HMAC_KEY / DATABASE_URL reach this process however it is started
# (uvicorn collection_app:app, main.py, or the Docker entrypoint), without
# pulling in legacy Perfios-only configuration. override=False (the default)
# so a checked-in/local .env only fills gaps and never clobbers an explicitly
# supplied runtime/Docker environment variable of the same name -- which is how
# a Secret Manager-injected value wins over anything baked into an image.
load_dotenv()


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
    configure_logging(settings.log_level)

    collection_app = FastAPI(
        title="Navdhan Collection API",
        version="1.0.0",
        lifespan=lifespan,
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

    from routes.collection_application import router as collection_application_router
    from routes.collection_requirements import router as collection_requirements_router
    from routes.collection_submission import router as collection_submission_router

    collection_app.include_router(collection_application_router)
    collection_app.include_router(collection_requirements_router)
    collection_app.include_router(collection_submission_router)

    @collection_app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return collection_app


app = build_collection_app()
