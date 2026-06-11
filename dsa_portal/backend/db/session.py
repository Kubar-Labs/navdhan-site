"""
Async SQLAlchemy engine + per-request session dependency.
Engine is initialized on FastAPI startup (main.py lifespan).
"""

from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (AsyncSession, create_async_engine,
                                    async_sessionmaker)
from fastapi import Request

from config import DATABASE_URL

_engine = None
_SessionFactory: async_sessionmaker[AsyncSession] | None = None


def init_engine() -> None:
    global _engine, _SessionFactory
    _engine = create_async_engine(
        DATABASE_URL,
        pool_size=10,
        max_overflow=10,
        pool_pre_ping=True,
        future=True,
    )
    _SessionFactory = async_sessionmaker(
        _engine, expire_on_commit=False, class_=AsyncSession
    )


async def close_engine() -> None:
    global _engine
    if _engine is not None:
        await _engine.dispose()
        _engine = None


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


def new_session() -> AsyncSession:
    """Session for background tasks — caller is responsible for commit/close."""
    if _SessionFactory is None:
        raise RuntimeError("DB engine not initialized")
    return _SessionFactory()
