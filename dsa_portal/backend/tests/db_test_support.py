"""Shared test-database configuration and safety guards.

Backend tests that need a real PostgreSQL connection must run against a
dedicated test database on the same local cluster, never against the
development database (the `DATABASE_URL` target, `postgres` locally). This module owns that configuration, the fail-fast guards that
refuse destructive cleanup outside the test database, and idempotent
schema/seed bootstrap so `python -m unittest discover -s tests` works with
no separate manual setup step.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
from pathlib import Path
from urllib.parse import urlsplit

import asyncpg
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_DIR.parents[1]
MIGRATIONS_DIR = REPO_ROOT / "database" / "migrations"
SEED_PATH = REPO_ROOT / "database" / "seeds" / "001_collection_flow.sql"

# The development DSN is environment-supplied now that collection_app carries
# no hard-coded default, so .env must be loaded before it can be read below.
load_dotenv(BACKEND_DIR / ".env")

_SAFE_DBNAME_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")


class UnsafeTestDatabaseError(RuntimeError):
    """Raised when destructive test cleanup would run against a non-test database."""


def _dbname_from_url(url: str) -> str:
    normalized = url.replace("postgresql+asyncpg://", "postgresql://")
    return urlsplit(normalized).path.lstrip("/")


# Same source the application reads, so the guard below compares the test
# database against whatever database this machine actually develops against.
DEV_DATABASE_URL = os.getenv("DATABASE_URL", "")
DEV_DATABASE_NAME = _dbname_from_url(DEV_DATABASE_URL) if DEV_DATABASE_URL else ""

# Same local trust-auth cluster as the dev database (127.0.0.1:55432), but a
# distinct database name so destructive test cleanup can never reach dev rows.
TEST_DATABASE_URL = os.getenv(
    "NAVDHAN_TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres@127.0.0.1:55432/navdhan_test",
)
TEST_PG_DSN = os.getenv(
    "NAVDHAN_TEST_PG_DSN",
    "postgresql://postgres@127.0.0.1:55432/navdhan_test",
)


def _configured_test_dbname() -> str:
    return _dbname_from_url(TEST_PG_DSN)


def guard_test_database_name() -> str:
    """Validate the *configured* test database name before connecting.

    Raises UnsafeTestDatabaseError if the configured test database is the
    development database, or does not follow the `_test` naming convention
    that marks a database as safe to wipe.
    """
    name = _configured_test_dbname()
    if not _SAFE_DBNAME_RE.match(name):
        raise UnsafeTestDatabaseError(
            f"Refusing to run destructive test cleanup: configured test "
            f"database name '{name}' is not a plain identifier."
        )
    if DEV_DATABASE_NAME and name == DEV_DATABASE_NAME:
        raise UnsafeTestDatabaseError(
            f"Refusing to run destructive test cleanup: configured test "
            f"database '{name}' is the development database "
            f"({DEV_DATABASE_URL}). Set NAVDHAN_TEST_PG_DSN / "
            f"NAVDHAN_TEST_DATABASE_URL to a dedicated test database."
        )
    if not name.endswith("_test"):
        raise UnsafeTestDatabaseError(
            f"Refusing to run destructive test cleanup: configured test "
            f"database '{name}' does not look like a test database "
            f"(expected a '_test' suffix)."
        )
    return name


async def guard_live_connection_is_test_database(
    connection: asyncpg.Connection,
) -> None:
    """Validate a *live* connection before any destructive statement runs.

    Defense in depth against the configured DSN and the actually-connected
    database drifting apart (wrong host/port, connection pooling mixups).
    """
    expected = guard_test_database_name()
    actual = await connection.fetchval("SELECT current_database()")
    if actual != expected:
        raise UnsafeTestDatabaseError(
            f"Refusing to run destructive test cleanup: connected to database "
            f"'{actual}', expected the configured test database '{expected}'."
        )
    if actual == DEV_DATABASE_NAME:
        raise UnsafeTestDatabaseError(
            f"Refusing to run destructive test cleanup: connected database "
            f"'{actual}' matches the development database name."
        )


async def _ensure_test_database_exists(dbname: str) -> None:
    # Every cluster has a "postgres" maintenance database; connecting to it
    # only to issue CREATE DATABASE is a non-destructive, read-only-for-dev-
    # data administrative action (it never touches dev rows/tables).
    maintenance_dsn = TEST_PG_DSN.rsplit("/", 1)[0] + "/postgres"
    connection = await asyncpg.connect(maintenance_dsn)
    try:
        exists = await connection.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1", dbname
        )
        if not exists:
            await connection.execute(f'CREATE DATABASE "{dbname}"')
    finally:
        await connection.close()


_DEFAULT_PSQL_PATH = r"C:\Program Files\PostgreSQL\18\bin\psql.exe"


def _psql_path() -> str:
    override = os.getenv("NAVDHAN_TEST_PSQL_PATH")
    if override:
        return override
    if Path(_DEFAULT_PSQL_PATH).exists():
        return _DEFAULT_PSQL_PATH
    found = shutil.which("psql")
    if found:
        return found
    raise UnsafeTestDatabaseError(
        "psql was not found. Set NAVDHAN_TEST_PSQL_PATH to the psql executable "
        "so the dedicated test database schema can be applied."
    )


def _run_psql_file(path: Path) -> None:
    parsed = urlsplit(TEST_PG_DSN.replace("postgresql+asyncpg://", "postgresql://"))
    dbname = parsed.path.lstrip("/")
    subprocess.run(
        [
            _psql_path(),
            "--no-password",
            "-h",
            parsed.hostname or "127.0.0.1",
            "-p",
            str(parsed.port or 5432),
            "-U",
            parsed.username or "postgres",
            "-d",
            dbname,
            "-v",
            "ON_ERROR_STOP=1",
            "-f",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )


async def ensure_test_schema() -> None:
    """Create, migrate, and seed the dedicated test database if needed.

    Idempotent: safe to call at the top of every test run. Applies migrations
    via `psql` (like `database/README.md` documents), not a batched asyncpg
    call, because migration 003 uses `CREATE INDEX CONCURRENTLY`, which
    cannot run inside the implicit transaction a multi-statement asyncpg
    `execute()` call would open.
    """
    dbname = guard_test_database_name()
    await _ensure_test_database_exists(dbname)

    connection = await asyncpg.connect(TEST_PG_DSN)
    try:
        await guard_live_connection_is_test_database(connection)
        has_schema = await connection.fetchval(
            "SELECT to_regclass('public.marketplaces')"
        )
    finally:
        await connection.close()

    try:
        if has_schema is None:
            _run_psql_file(MIGRATIONS_DIR / "001_collection_schema.up.sql")
        _run_psql_file(
            MIGRATIONS_DIR / "002_application_requirement_coverage_snapshot.up.sql"
        )
        _run_psql_file(MIGRATIONS_DIR / "003_person_email_lookup_hash.up.sql")
        _run_psql_file(MIGRATIONS_DIR / "004_document_scan_quarantine.up.sql")
        _run_psql_file(SEED_PATH)
    except subprocess.CalledProcessError as error:
        raise RuntimeError(
            f"Failed to apply schema/seed to the test database '{dbname}': "
            f"{error.stderr or error.stdout}"
        ) from error
