"""
climate_engine/db/session.py — Connection Pooling & Session Factory
"""

from __future__ import annotations

import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from climate_engine.settings import settings

logger = logging.getLogger(__name__)


def _build_async_url(raw_url: str) -> str:
    """Normalise any postgresql:// variant to postgresql+asyncpg://."""
    if raw_url.startswith("postgresql+asyncpg://"):
        return raw_url
    if raw_url.startswith("postgresql://"):
        return raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if raw_url.startswith("postgresql+"):
        scheme_end = raw_url.index("://")
        return "postgresql+asyncpg" + raw_url[scheme_end:]
    raise ValueError(
        f"session.py: Unsupported DB scheme: '{raw_url.split(':')[0]}'"
    )


def _create_engine() -> AsyncEngine:
    raw_url   = settings.POSTGRES_URL.get_secret_value()
    async_url = _build_async_url(raw_url)

    engine = create_async_engine(
        async_url,
        # ── All pool values from settings — never hardcoded ───────────────
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_timeout=settings.DB_POOL_TIMEOUT,
        pool_recycle=settings.DB_POOL_RECYCLE,
        pool_pre_ping=True,          # liveness check before each checkout
        isolation_level="READ COMMITTED",  # prevent dirty reads globally
        echo=False,
        # ── asyncpg server-side statement timeout ─────────────────────────
        # Kills queries that exceed DB_STATEMENT_TIMEOUT_MS on the DB server.
        # Prevents zombie queries from holding pool connections indefinitely.
        connect_args={
            "server_settings": {
                "statement_timeout": str(settings.DB_STATEMENT_TIMEOUT_MS)
            }
        },
    )

    logger.info(
        "session.py: Engine created — pool_size=%d, max_overflow=%d, "
        "pool_timeout=%ds, pool_recycle=%ds, statement_timeout=%dms.",
        settings.DB_POOL_SIZE,
        settings.DB_MAX_OVERFLOW,
        settings.DB_POOL_TIMEOUT,
        settings.DB_POOL_RECYCLE,
        settings.DB_STATEMENT_TIMEOUT_MS,
    )
    return engine


# One engine per process — shared across all requests
engine: AsyncEngine = _create_engine()

# expire_on_commit=False is mandatory for async SQLAlchemy:
# after commit(), attributes must remain readable without triggering
# a lazy reload (which would fail with no implicit async I/O).
AsyncSessionFactory: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency. Yields a transactional session.
    Commits on success, rolls back on any exception, always closes.
    """
    async with AsyncSessionFactory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


@asynccontextmanager
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Context manager for non-FastAPI callers (scripts, jobs, tests).
    """
    async with AsyncSessionFactory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db() -> None:
    """Create all tables. Development only — use Alembic in production."""
    from climate_engine.db.base import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("session.py: init_db() complete.")


async def close_db() -> None:
    """Dispose engine on shutdown. Call from FastAPI lifespan teardown."""
    await engine.dispose()
    logger.info("session.py: Engine disposed.")