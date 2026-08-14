"""Minimal FastAPI application for the collection-only backend."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from dotenv import load_dotenv
from fastapi import FastAPI

# Load .env independently of the legacy config.py so ENCRYPTION_KEY /
# LOOKUP_HMAC_KEY / DATABASE_URL reach this process however it is started
# (uvicorn collection_app:app, main.py, or the Docker entrypoint), without
# pulling in legacy Perfios-only configuration. override=False (the default)
# so a checked-in/local .env only fills gaps and never clobbers an explicitly
# supplied runtime/Docker environment variable of the same name.
load_dotenv()

LOCAL_COLLECTION_DATABASE_URL = (
    "postgresql+asyncpg://postgres@127.0.0.1:55432/postgres"
)


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

        collection_database_url = database_url or LOCAL_COLLECTION_DATABASE_URL
        init_engine(collection_database_url)
        try:
            await check_connection()
            yield
        finally:
            await close_engine()

    collection_app = FastAPI(
        title="Navdhan Collection API",
        version="1.0.0",
        lifespan=lifespan,
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
