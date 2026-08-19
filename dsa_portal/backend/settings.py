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
DEFAULT_DB_POOL_SIZE = 10
DEFAULT_DB_MAX_OVERFLOW = 10
DEFAULT_LOG_LEVEL = "INFO"
DEFAULT_APP_ENV = "dev"
MIN_SERVICE_TOKEN_BYTES = 32
DEPLOYED_APP_ENVS = frozenset({"stage", "staging", "prod", "production"})
VALID_APP_ENVS = frozenset(
    {"dev", "development", "test", "testing", *DEPLOYED_APP_ENVS}
)


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
        return (
            f"postgresql+asyncpg://{credentials}@/{name}?host={quote(host, safe='/')}"
        )

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


def _parse_allowed_origins(raw: str | None, *, deployed: bool) -> list[str]:
    if raw is None:
        return [] if deployed else ["*"]
    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
    if deployed and "*" in origins:
        raise ConfigurationError(
            "ALLOWED_ORIGINS cannot contain a wildcard in a deployed environment"
        )
    return origins or ([] if deployed else ["*"])


def _resolve_service_token(*, deployed: bool) -> str | None:
    token = os.getenv("APPLY_SERVICE_TOKEN")
    if not token:
        if deployed:
            raise ConfigurationError(
                "APPLY_SERVICE_TOKEN is required in deployed environments and must be at "
                f"least {MIN_SERVICE_TOKEN_BYTES} bytes"
            )
        return None
    if len(token.encode("utf-8")) < MIN_SERVICE_TOKEN_BYTES:
        raise ConfigurationError(
            f"APPLY_SERVICE_TOKEN must be at least {MIN_SERVICE_TOKEN_BYTES} bytes"
        )
    return token


def _resolve_optional_service_token(name: str) -> str | None:
    token = os.getenv(name)
    if not token:
        return None
    if len(token.encode("utf-8")) < MIN_SERVICE_TOKEN_BYTES:
        raise ConfigurationError(
            f"{name} must be at least {MIN_SERVICE_TOKEN_BYTES} bytes"
        )
    return token


def _resolve_scan_callback_token(*, deployed: bool) -> str | None:
    token = _resolve_optional_service_token("DOCUMENT_SCAN_CALLBACK_TOKEN")
    if token is None and deployed:
        raise ConfigurationError(
            "DOCUMENT_SCAN_CALLBACK_TOKEN is required in deployed environments and must be at "
            f"least {MIN_SERVICE_TOKEN_BYTES} bytes"
        )
    return token


@dataclass(frozen=True)
class Settings:
    app_env: str
    log_level: str
    host: str
    port: int
    allowed_origins: list[str]
    service_token: str | None
    document_scan_callback_token: str | None
    gcs_bucket: str | None
    google_cloud_project: str | None
    # Per-process connection pool. The database's max_connections must cover
    # (pool_size + max_overflow) x number of running instances.
    db_pool_size: int
    db_max_overflow: int

    @property
    def allows_any_origin(self) -> bool:
        return "*" in self.allowed_origins

    @property
    def is_deployed(self) -> bool:
        return self.app_env in DEPLOYED_APP_ENVS


def _resolve_int(raw: str | None, *, default: int, name: str, minimum: int = 0) -> int:
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError as error:
        raise ConfigurationError(f"{name} must be an integer, got {raw!r}") from error
    if value < minimum:
        raise ConfigurationError(f"{name} must be at least {minimum}, got {value}")
    return value


def load_settings() -> Settings:
    # APP_ENV and ENV are the same setting under two names (the legacy
    # architecture docs used ENV, ci/cloudbuild-backend.yaml uses APP_ENV).
    app_env = (
        (os.getenv("APP_ENV") or os.getenv("ENV") or DEFAULT_APP_ENV).strip().lower()
    )
    if app_env not in VALID_APP_ENVS:
        allowed = ", ".join(sorted(VALID_APP_ENVS))
        raise ConfigurationError(
            f"APP_ENV must be one of: {allowed}; got an unrecognised value"
        )
    deployed = app_env in DEPLOYED_APP_ENVS
    service_token = _resolve_service_token(deployed=deployed)
    document_scan_callback_token = _resolve_scan_callback_token(deployed=deployed)
    if (
        service_token is not None
        and document_scan_callback_token is not None
        and service_token == document_scan_callback_token
    ):
        raise ConfigurationError(
            "DOCUMENT_SCAN_CALLBACK_TOKEN must be distinct from APPLY_SERVICE_TOKEN"
        )
    gcs_bucket = (os.getenv("GCS_BUCKET") or "").strip() or None
    google_cloud_project = (
        (os.getenv("GOOGLE_CLOUD_PROJECT") or "").strip() or None
    )
    if deployed and not gcs_bucket:
        raise ConfigurationError("GCS_BUCKET is required in deployed environments")
    if deployed and not google_cloud_project:
        raise ConfigurationError(
            "GOOGLE_CLOUD_PROJECT is required in deployed environments"
        )
    return Settings(
        app_env=app_env,
        log_level=(os.getenv("LOG_LEVEL") or DEFAULT_LOG_LEVEL).upper(),
        host=os.getenv("HOST") or DEFAULT_HOST,
        port=_resolve_int(
            os.getenv("PORT"), default=DEFAULT_PORT, name="PORT", minimum=1
        ),
        allowed_origins=_parse_allowed_origins(
            os.getenv("ALLOWED_ORIGINS"), deployed=deployed
        ),
        service_token=service_token,
        document_scan_callback_token=document_scan_callback_token,
        gcs_bucket=gcs_bucket,
        google_cloud_project=google_cloud_project,
        db_pool_size=_resolve_int(
            os.getenv("DB_POOL_SIZE"),
            default=DEFAULT_DB_POOL_SIZE,
            name="DB_POOL_SIZE",
            minimum=1,
        ),
        db_max_overflow=_resolve_int(
            os.getenv("DB_MAX_OVERFLOW"),
            default=DEFAULT_DB_MAX_OVERFLOW,
            name="DB_MAX_OVERFLOW",
            minimum=0,
        ),
    )


def configure_logging(log_level: str) -> None:
    """Apply LOG_LEVEL. An unrecognised value falls back to INFO rather than
    crashing the process over a logging setting."""
    level = logging.getLevelNamesMapping().get(log_level)
    if level is None:
        logging.basicConfig(level=logging.INFO)
        logging.getLogger(__name__).warning(
            "Unrecognised LOG_LEVEL %r; falling back to INFO", log_level
        )
        return
    logging.basicConfig(level=level)
