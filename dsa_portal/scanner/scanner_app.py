"""Eventarc-driven malware scanner for quarantined NavDhan PDFs."""

from __future__ import annotations

import asyncio
import hashlib
import os
import re
import subprocess
import tempfile
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, AsyncIterator, Awaitable, Callable
from urllib.parse import urlsplit

import httpx
from fastapi import FastAPI, HTTPException, Request, status
from google.cloud import storage


_QUARANTINE_OBJECT = re.compile(
    r"^quarantine/"
    r"(?P<marketplace>[0-9a-fA-F-]{36})/"
    r"(?P<application>[0-9a-fA-F-]{36})/"
    r"(?P<document>[0-9a-fA-F-]{36})\.pdf$"
)
_FINALIZE_EVENT = "google.cloud.storage.object.v1.finalized"
_CLOUD_EVENT_SPEC_VERSION = "1.0"


class ScannerUnavailableError(RuntimeError):
    """The malware engine could not produce a trustworthy verdict."""


@dataclass(frozen=True)
class Settings:
    bucket: str
    backend_url: str
    callback_token: str
    max_bytes: int = 20 * 1024 * 1024


def load_settings() -> Settings:
    bucket = os.getenv("GCS_BUCKET", "").strip()
    backend_url = os.getenv("BACKEND_URL", "").strip().rstrip("/")
    callback_token = os.getenv("DOCUMENT_SCAN_CALLBACK_TOKEN", "")
    if not bucket:
        raise RuntimeError("GCS_BUCKET is required")
    parsed_backend = urlsplit(backend_url)
    if (
        parsed_backend.scheme != "https"
        or not parsed_backend.hostname
        or parsed_backend.username is not None
        or parsed_backend.password is not None
        or parsed_backend.path not in ("", "/")
        or parsed_backend.query
        or parsed_backend.fragment
    ):
        raise RuntimeError("BACKEND_URL must be an HTTPS origin without credentials or a path")
    if len(callback_token.encode("utf-8")) < 32:
        raise RuntimeError("DOCUMENT_SCAN_CALLBACK_TOKEN must contain at least 32 bytes")
    return Settings(
        bucket=bucket,
        backend_url=backend_url,
        callback_token=callback_token,
    )


def _document_id(object_name: str) -> uuid.UUID | None:
    match = _QUARANTINE_OBJECT.fullmatch(object_name)
    if match is None:
        return None
    try:
        # Validate every server-generated identifier, not only the filename.
        uuid.UUID(match.group("marketplace"))
        uuid.UUID(match.group("application"))
        return uuid.UUID(match.group("document"))
    except ValueError:
        return None


def _scan_file(path: Path) -> str:
    try:
        completed = subprocess.run(
            [
                "clamscan",
                "--no-summary",
                "--infected",
                "--official-db-only=yes",
                "--fail-if-cvd-older-than=2",
                "--alert-encrypted-doc=yes",
                "--alert-exceeds-max=yes",
                "--follow-file-symlinks=0",
                "--max-filesize=20M",
                "--max-scansize=25M",
                "--max-files=1000",
                "--max-recursion=4",
                str(path),
            ],
            check=False,
            capture_output=True,
            timeout=90,
            text=True,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        raise ScannerUnavailableError("ClamAV did not complete") from error
    if completed.returncode == 0:
        return "clean"
    if completed.returncode == 1:
        return "infected"
    # Exit code 2 covers missing/stale signatures, resource-limit failures,
    # and engine errors. Retrying preserves the quarantine object; accepting a
    # terminal unreadable verdict here would permanently discard a file that
    # was never reliably scanned.
    raise ScannerUnavailableError("ClamAV could not produce a verdict")


def _sha256_file(path: Path) -> str:
    with path.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def _download_exact_generation(
    *,
    client: storage.Client,
    bucket_name: str,
    object_name: str,
    generation: int,
    destination: Path,
) -> None:
    blob = client.bucket(bucket_name).blob(object_name, generation=generation)
    blob.download_to_filename(
        str(destination),
        if_generation_match=generation,
        timeout=60,
        checksum="auto",
    )


def _post_verdict(
    *,
    settings: Settings,
    document_id: uuid.UUID,
    generation: int,
    digest: str,
    event_id: str,
    verdict: str,
) -> None:
    response = httpx.post(
        f"{settings.backend_url}/internal/document-scans/{document_id}/result",
        headers={"x-navdhan-scan-token": settings.callback_token},
        json={
            "scan_result": verdict,
            "gcs_generation": generation,
            "sha256": digest,
            "scanner_job_id": event_id,
        },
        timeout=30,
    )
    response.raise_for_status()


def create_app(
    *,
    settings_loader: Callable[[], Settings] = load_settings,
    storage_client_factory: Callable[[], storage.Client] = storage.Client,
    scan_file: Callable[[Path], str] = _scan_file,
    post_verdict: Callable[..., None] = _post_verdict,
    run_sync: Callable[..., Awaitable[Any]] = asyncio.to_thread,
) -> FastAPI:
    loaded_settings: Settings | None = None

    def current_settings() -> Settings:
        # ASGI unit transports do not run lifespan automatically, so retain a
        # lazy fallback while production uvicorn still validates at startup.
        return loaded_settings or settings_loader()

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        nonlocal loaded_settings
        loaded_settings = settings_loader()
        yield

    app = FastAPI(
        title="NavDhan Document Scanner",
        lifespan=lifespan,
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/")
    async def scan_event(request: Request) -> dict[str, str]:
        settings = current_settings()
        if request.headers.get("ce-specversion") != _CLOUD_EVENT_SPEC_VERSION:
            raise HTTPException(status_code=400, detail="Unsupported CloudEvent version")
        if request.headers.get("ce-type") != _FINALIZE_EVENT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported event type",
            )
        event_id = (request.headers.get("ce-id") or "").strip()
        if not event_id or len(event_id) > 200 or not re.fullmatch(
            r"[A-Za-z0-9._:-]+", event_id
        ):
            raise HTTPException(status_code=400, detail="Invalid event id")

        try:
            payload: dict[str, Any] = await request.json()
            object_name = str(payload["name"])
            bucket_name = str(payload["bucket"])
            generation = int(payload["generation"])
            reported_size = int(payload.get("size", 0))
        except (KeyError, TypeError, ValueError) as error:
            raise HTTPException(status_code=400, detail="Invalid storage event") from error

        if bucket_name != settings.bucket:
            raise HTTPException(status_code=403, detail="Unexpected bucket")
        expected_source = f"//storage.googleapis.com/projects/_/buckets/{settings.bucket}"
        if request.headers.get("ce-source") != expected_source:
            raise HTTPException(status_code=403, detail="Unexpected event source")
        if request.headers.get("ce-subject") != f"objects/{object_name}":
            raise HTTPException(status_code=400, detail="Event subject does not match object")
        document_id = _document_id(object_name)
        if document_id is None:
            # Finalize events for clean/ and unrelated prefixes are intentionally ignored.
            return {"status": "ignored"}
        if generation <= 0:
            raise HTTPException(status_code=400, detail="Invalid generation")
        if reported_size < 1 or reported_size > settings.max_bytes:
            raise HTTPException(status_code=422, detail="Invalid object size")

        try:
            client = await run_sync(storage_client_factory)
        except Exception as error:
            raise HTTPException(status_code=503, detail="Scanner unavailable") from error
        with tempfile.TemporaryDirectory(prefix="navdhan-scan-") as directory:
            path = Path(directory) / f"{document_id}.pdf"
            try:
                await run_sync(
                    _download_exact_generation,
                    client=client,
                    bucket_name=bucket_name,
                    object_name=object_name,
                    generation=generation,
                    destination=path,
                )
            except Exception as error:
                raise HTTPException(status_code=503, detail="Scanner unavailable") from error
            actual_size = path.stat().st_size
            if actual_size != reported_size or actual_size > settings.max_bytes:
                raise HTTPException(status_code=422, detail="Object size mismatch")
            digest = await run_sync(_sha256_file, path)
            try:
                verdict = await run_sync(scan_file, path)
            except ScannerUnavailableError as error:
                raise HTTPException(status_code=503, detail="Scanner unavailable") from error

        try:
            await run_sync(
                post_verdict,
                settings=settings,
                document_id=document_id,
                generation=generation,
                digest=digest,
                event_id=event_id,
                verdict=verdict,
            )
        except Exception as error:
            # Eventarc retries non-2xx responses. The backend callback itself
            # is idempotent for the exact event/generation/hash/verdict tuple.
            raise HTTPException(status_code=503, detail="Callback unavailable") from error
        return {"status": verdict}

    return app


app = create_app()
