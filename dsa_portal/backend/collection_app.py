"""Minimal FastAPI application for the collection-only backend."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI

LOCAL_COLLECTION_DATABASE_URL = (
    "postgresql+asyncpg://postgres@127.0.0.1:55432/postgres"
)


def build_collection_app(
    *, database_url: str | None = None, run_database_probe: bool = True
) -> FastAPI:
    """Build the collection app without importing the legacy API runtime."""

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
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

    collection_app.include_router(collection_application_router)

    @collection_app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return collection_app


app = build_collection_app()
