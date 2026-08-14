"""Local-first document storage behind a small, GCS-shaped interface.

`LocalDocumentStorage` is the only implementation used by the collection-only
flow. A future `GCSStorage` can satisfy the same interface (`save`/`delete`
returning/consuming the same bucket+object shape) with no route or service
contract change, per the collection-only plan.
"""

from __future__ import annotations

import hashlib
import os
import uuid
from dataclasses import dataclass
from pathlib import Path

LOCAL_BUCKET_NAME = "local"


class DocumentTooLargeError(Exception):
    """The uploaded file exceeds the document type's configured limit."""


class DocumentEmptyError(Exception):
    """The uploaded file has no content."""


class DocumentInvalidPdfError(Exception):
    """The uploaded file is not application/pdf or fails the PDF signature check."""


class DocumentPathTraversalError(Exception):
    """A storage object key resolves outside the configured storage root."""

    def __init__(self, object_key: str) -> None:
        super().__init__(f"Object key escapes the storage root: {object_key!r}")
        self.object_key = object_key


@dataclass
class StoredDocument:
    bucket: str
    object_key: str
    size_bytes: int
    sha256: bytes


def _storage_root() -> Path:
    configured = os.getenv("LOCAL_DOCUMENT_STORAGE_ROOT")
    root = Path(configured) if configured else Path(__file__).resolve().parents[1] / ".local_documents"
    root.mkdir(parents=True, exist_ok=True)
    return root


_TRAILER_SEARCH_WINDOW = 2048


def validate_pdf_bytes(
    data: bytes, *, mime_type: str, filename: str | None, max_size_bytes: int
) -> None:
    if len(data) == 0:
        raise DocumentEmptyError
    if len(data) > max_size_bytes:
        raise DocumentTooLargeError
    if mime_type != "application/pdf":
        raise DocumentInvalidPdfError
    # Filename is validation metadata only — never used to build a storage
    # path (paths are built from server-generated UUIDs; see save()).
    if not filename or not filename.strip().lower().endswith(".pdf"):
        raise DocumentInvalidPdfError
    if not data.startswith(b"%PDF-"):
        raise DocumentInvalidPdfError
    # Minimal structural-readability check: a well-formed PDF ends with an
    # `%%EOF` trailer marker. This rejects header-only/truncated/corrupt
    # uploads without doing real PDF parsing, OCR, or extraction.
    if b"%%EOF" not in data[-_TRAILER_SEARCH_WINDOW:]:
        raise DocumentInvalidPdfError


class LocalDocumentStorage:
    """Writes validated PDF bytes to a local, tenant/application-scoped path."""

    def save(
        self,
        *,
        marketplace_id: uuid.UUID,
        application_id: uuid.UUID,
        document_id: uuid.UUID,
        data: bytes,
    ) -> StoredDocument:
        root = _storage_root()
        relative_dir = Path(str(marketplace_id)) / str(application_id)
        absolute_dir = root / relative_dir
        absolute_dir.mkdir(parents=True, exist_ok=True)
        object_key = f"{relative_dir.as_posix()}/{document_id}.pdf"
        final_path = root / object_key
        temp_path = final_path.with_suffix(f".{uuid.uuid4().hex}.tmp")
        temp_path.write_bytes(data)
        os.replace(temp_path, final_path)
        return StoredDocument(
            bucket=LOCAL_BUCKET_NAME,
            object_key=object_key,
            size_bytes=len(data),
            sha256=hashlib.sha256(data).digest(),
        )

    def delete(self, *, object_key: str) -> None:
        root = _storage_root().resolve()
        candidate = (root / object_key).resolve()
        try:
            candidate.relative_to(root)
        except ValueError:
            # Object key escapes the storage root (parent traversal, an
            # absolute path, etc.) — refuse rather than deleting outside it.
            raise DocumentPathTraversalError(object_key)
        try:
            candidate.unlink(missing_ok=True)
        except OSError:
            pass
