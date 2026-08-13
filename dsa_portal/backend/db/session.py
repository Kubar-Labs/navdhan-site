"""
Async SQLAlchemy engine + per-request session dependency.
Engine is initialized on FastAPI startup (main.py lifespan).
"""

from contextlib import asynccontextmanager
from inspect import iscoroutine
from typing import AsyncGenerator, AsyncIterator
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from fastapi import Request

_engine: AsyncEngine | None = None
_SessionFactory: async_sessionmaker[AsyncSession] | None = None


def init_engine(database_url: str | None = None) -> None:
    """Initialize the async engine, resolving the legacy default lazily."""
    global _engine, _SessionFactory
    if database_url is None:
        from config import DATABASE_URL

        database_url = DATABASE_URL

    _engine = create_async_engine(
        database_url,
        pool_size=10,
        max_overflow=10,
        pool_pre_ping=True,
        future=True,
    )
    _SessionFactory = async_sessionmaker(
        _engine, expire_on_commit=False, class_=AsyncSession
    )


async def check_connection() -> None:
    """Fail startup unless the configured database accepts a simple query."""
    if _engine is None:
        raise RuntimeError("DB engine not initialized")
    async with _engine.connect() as connection:
        await connection.execute(text("SELECT 1"))


async def close_engine() -> None:
    global _engine, _SessionFactory
    engine = _engine
    _engine = None
    _SessionFactory = None
    if engine is not None:
        await engine.dispose()


async def get_session(request: Request) -> AsyncGenerator[AsyncSession, None]:
    if _SessionFactory is None:
        raise RuntimeError("DB engine not initialized — did lifespan run?")
    async with _SessionFactory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


@asynccontextmanager
async def tenant_session(tenant_id: UUID) -> AsyncIterator[AsyncSession]:
    """Yield a transaction whose PostgreSQL RLS context is tenant-scoped."""
    if _SessionFactory is None:
        raise RuntimeError("DB engine not initialized")

    async with _SessionFactory() as database_session:
        transaction = database_session.begin()
        if iscoroutine(transaction):
            transaction = await transaction
        async with transaction:
            await database_session.execute(
                text(
                    "SELECT set_config("
                    "'app.current_marketplace_id', :tenant_id, true"
                    ")"
                ),
                {"tenant_id": str(tenant_id)},
            )
            yield database_session


def new_session() -> AsyncSession:
    """Session for background tasks — caller is responsible for commit/close."""
    if _SessionFactory is None:
        raise RuntimeError("DB engine not initialized")
    return _SessionFactory()
