"""Storage-agnostic document contracts and upload validation.

Everything here is independent of where bytes actually land: the exceptions
routes translate into HTTP responses, the `StoredDocument` value returned to
the service layer, the `DocumentStorage` protocol an implementation must
satisfy, and the PDF validation that runs before any implementation is called.

`storage.gcs.GCSStorage` is the implementation used by the collection flow.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Protocol


class DocumentTooLargeError(Exception):
    """The uploaded file exceeds the document type's configured limit."""


class DocumentEmptyError(Exception):
    """The uploaded file has no content."""


class DocumentInvalidPdfError(Exception):
    """The uploaded file is not application/pdf or fails the PDF signature check."""


class DocumentStorageError(Exception):
    """The storage backend could not complete a save or delete."""


class DocumentPathTraversalError(Exception):
    """A storage object key is not a plain, relative, application-scoped key."""

    def __init__(self, object_key: str) -> None:
        super().__init__(f"Unsafe storage object key: {object_key!r}")
        self.object_key = object_key


@dataclass
class StoredDocument:
    bucket: str
    object_key: str
    size_bytes: int
    sha256: bytes
    generation: int | None = None


class DocumentStorage(Protocol):
    """The contract the service layer depends on, independent of backend."""

    def save(
        self,
        *,
        marketplace_id: uuid.UUID,
        application_id: uuid.UUID,
        document_id: uuid.UUID,
        data: bytes,
    ) -> StoredDocument:
        ...

    def delete(self, *, object_key: str) -> None:
        ...


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
    # path (paths are built from server-generated UUIDs; see GCSStorage.save).
    if not filename or not filename.strip().lower().endswith(".pdf"):
        raise DocumentInvalidPdfError
    if not data.startswith(b"%PDF-"):
        raise DocumentInvalidPdfError
    # Minimal structural-readability check: a well-formed PDF ends with an
    # `%%EOF` trailer marker. This rejects header-only/truncated/corrupt
    # uploads without doing real PDF parsing, OCR, or extraction.
    if b"%%EOF" not in data[-_TRAILER_SEARCH_WINDOW:]:
        raise DocumentInvalidPdfError
