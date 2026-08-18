"""Runtime configuration for the collection-only backend.

Every deployment-varying value is read from the environment here so nothing is
pinned in code. This is *not* a revival of the legacy `config.py` deleted in
Phase 7 — that module carried Perfios credentials and provider wiring, none of
which exists any more. This one only covers the collection runtime.

Precedence note: `DATABASE_URL` wins when set. Otherwise the DSN is composed
from the `DB_*` parts, which is the shape Cloud SQL wants when connecting over
a unix socket (`DB_HOST=/cloudsql/project:region:instance`).
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from urllib.parse import quote, quote_plus

DEFAULT_HOST = "0.0.0.0"
DEFAULT_PORT = 8000
DEFAULT_DB_PORT = 5432
DEFAULT_LOG_LEVEL = "INFO"
DEFAULT_APP_ENV = "dev"


class ConfigurationError(RuntimeError):
    """The environment does not describe a runnable configuration."""


def _compose_database_url() -> str | None:
    """Build a DSN from the DB_* parts, or None if they are not all present."""
    host = os.getenv("DB_HOST")
    user = os.getenv("DB_USER")
    name = os.getenv("DB_NAME")
    if not (host and user and name):
        return None

    password = os.getenv("DB_PASSWORD")
    credentials = quote_plus(user)
    if password:
        credentials = f"{credentials}:{quote_plus(password)}"

    if host.startswith("/"):
        # Cloud SQL unix socket. asyncpg takes the socket directory as a query
        # parameter rather than a netloc host.
        return f"postgresql+asyncpg://{credentials}@/{name}?host={quote(host, safe='/')}"

    port = os.getenv("DB_PORT", str(DEFAULT_DB_PORT))
    return f"postgresql+asyncpg://{credentials}@{host}:{port}/{name}"


def resolve_database_url() -> str:
    """Return the database DSN from the environment.

    Deliberately has no built-in default. A hard-coded local DSN lets a
    deployed container start up and silently dial its own loopback instead of
    the intended Cloud SQL instance, so a missing value must fail at boot
    rather than surface later as a confusing connection error.
    """
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return database_url

    composed = _compose_database_url()
    if composed:
        return composed

    raise ConfigurationError(
        "DATABASE_URL is not set, and DB_HOST/DB_USER/DB_NAME are not all "
        "present to compose one. Set either in dsa_portal/backend/.env for "
        "local runs, or inject them from Secret Manager for deployed "
        "environments. See .env.example."
    )


def _parse_allowed_origins(raw: str | None) -> list[str]:
    if raw is None:
        return ["*"]
    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
    return origins or ["*"]


@dataclass(frozen=True)
class Settings:
    app_env: str
    log_level: str
    host: str
    port: int
    allowed_origins: list[str]
    gcs_bucket: str | None
    google_cloud_project: str | None

    @property
    def allows_any_origin(self) -> bool:
        return "*" in self.allowed_origins


def _resolve_port(raw: str | None, *, default: int, name: str) -> int:
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError as error:
        raise ConfigurationError(f"{name} must be an integer, got {raw!r}") from error


def load_settings() -> Settings:
    # APP_ENV and ENV are the same setting under two names (the legacy
    # architecture docs used ENV, ci/cloudbuild-backend.yaml uses APP_ENV).
    app_env = os.getenv("APP_ENV") or os.getenv("ENV") or DEFAULT_APP_ENV
    return Settings(
        app_env=app_env,
        log_level=(os.getenv("LOG_LEVEL") or DEFAULT_LOG_LEVEL).upper(),
        host=os.getenv("HOST") or DEFAULT_HOST,
        port=_resolve_port(os.getenv("PORT"), default=DEFAULT_PORT, name="PORT"),
        allowed_origins=_parse_allowed_origins(os.getenv("ALLOWED_ORIGINS")),
        gcs_bucket=os.getenv("GCS_BUCKET"),
        google_cloud_project=os.getenv("GOOGLE_CLOUD_PROJECT"),
    )


def configure_logging(log_level: str) -> None:
    """Apply LOG_LEVEL. An unrecognised value falls back to INFO rather than
    crashing the process over a logging setting."""
    level = logging.getLevelName(log_level)
    if not isinstance(level, int):
        logging.basicConfig(level=logging.INFO)
        logging.getLogger(__name__).warning(
            "Unrecognised LOG_LEVEL %r; falling back to INFO", log_level
        )
        return
    logging.basicConfig(level=level)
