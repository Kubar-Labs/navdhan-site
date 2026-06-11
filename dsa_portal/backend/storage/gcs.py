"""
GCS upload helper. Uses Application Default Credentials (ADC).
Client is lazy-initialized so imports don't hit GCP.
"""

import asyncio
import hashlib
from dataclasses import dataclass
from typing import Optional
from google.cloud import storage

from config import GCS_BUCKET

_client: storage.Client | None = None


def _get_client() -> storage.Client:
    global _client
    if _client is None:
        _client = storage.Client()
    return _client


@dataclass
class UploadResult:
    bucket: str
    path: str
    size_bytes: int
    sha256: str
    content_type: str


def _sync_upload(path: str, data: bytes, content_type: str) -> UploadResult:
    bucket = _get_client().bucket(GCS_BUCKET)
    blob   = bucket.blob(path)
    blob.upload_from_string(data, content_type=content_type)
    return UploadResult(
        bucket       = GCS_BUCKET,
        path         = path,
        size_bytes   = len(data),
        sha256       = hashlib.sha256(data).hexdigest(),
        content_type = content_type,
    )


async def upload_bytes(path: str, data: bytes, content_type: str = "application/octet-stream") -> UploadResult:
    """Upload bytes to GCS. `path` is the object key (no gs:// prefix)."""
    return await asyncio.to_thread(_sync_upload, path, data, content_type)


def build_doc_path(case_id: str, doc_type: str, filename: str) -> str:
    """Canonical GCS path for a document. Keeps prod/dev bucket separation clean."""
    safe = filename.replace("/", "_").replace("\\", "_")
    return f"cases/{case_id}/{doc_type}/{safe}"


async def download_to_gcs(url: str, gcs_path: str,
                           content_type: str = "application/octet-stream",
                           timeout: float = 60.0) -> Optional[UploadResult]:
    """
    Fetch a remote URL (e.g. Perfios's 14-day download link) and upload the
    body to GCS at `gcs_path`. Returns None on any HTTP/network failure;
    callers handle that as "we have the URL but couldn't archive it".
    """
    if not url:
        return None
    import httpx
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as cli:
            resp = await cli.get(url)
            resp.raise_for_status()
            data = resp.content
            ct   = resp.headers.get("content-type") or content_type
        return await upload_bytes(gcs_path, data, ct)
    except Exception:
        return None
