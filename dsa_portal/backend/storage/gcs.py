"""Google Cloud Storage implementation of the `DocumentStorage` contract.

Replaces the local filesystem backend the collection flow used through Phase 8.
Object layout mirrors what that backend produced, so keys already recorded in
`documents.gcs_object` stay meaningful:

    {marketplace_id}/{application_id}/{document_id}.pdf

Note this is a fresh implementation of `storage.documents.DocumentStorage`, not
the `storage/gcs.py` deleted in Phase 7 — that one was a Perfios report-archival
helper coupled to the removed legacy `config.py`.
"""

from __future__ import annotations

import hashlib
import re
import uuid

from google.api_core import exceptions as gcs_exceptions
from google.auth import exceptions as auth_exceptions
from google.cloud import storage as gcs

from settings import load_settings
from storage.documents import (
    DocumentPathTraversalError,
    DocumentStorageError,
    StoredDocument,
)

_CONTENT_TYPE = "application/pdf"

# Keys are always built from server-generated UUIDs, so anything that is not a
# plain relative path of safe segments did not come from save() and must not be
# handed to the bucket. Mirrors the containment guard the filesystem backend
# enforced against parent-directory traversal.
_UNSAFE_SEGMENTS = {"", ".", ".."}

# Credential problems surface at request time, not client construction: an
# expired ADC token raises RefreshError from inside upload/delete. That is not
# a GoogleAPIError, so it needs catching explicitly or it escapes unwrapped.
_BACKEND_ERRORS = (gcs_exceptions.GoogleAPIError, auth_exceptions.GoogleAuthError)
_SAFE_SEGMENT_RE = re.compile(r"^[A-Za-z0-9._-]+$")
_QUARANTINE_PREFIX = "quarantine/"
_CLEAN_PREFIX = "clean/"


def _require_bucket_name(configured: str | None) -> str:
    bucket_name = configured or load_settings().gcs_bucket
    if not bucket_name:
        raise DocumentStorageError(
            "GCS_BUCKET is not set. Document storage cannot resolve a bucket. "
            "See dsa_portal/backend/.env.example."
        )
    return bucket_name


def _validate_object_key(object_key: str) -> str:
    if not object_key or object_key.startswith("/") or "\\" in object_key:
        raise DocumentPathTraversalError(object_key)
    segments = object_key.split("/")
    for segment in segments:
        if segment in _UNSAFE_SEGMENTS or not _SAFE_SEGMENT_RE.match(segment):
            raise DocumentPathTraversalError(object_key)
    return object_key


class GCSStorage:
    """Stores validated PDF bytes as objects in a single GCS bucket.

    The client is created lazily on first use rather than in `__init__`, so
    importing the service layer never requires credentials — the module-level
    instance in `services.collection_requirements` would otherwise force every
    import (tests included) to authenticate against Google.
    """

    def __init__(
        self,
        *,
        bucket_name: str | None = None,
        client: gcs.Client | None = None,
    ) -> None:
        self._configured_bucket_name = bucket_name
        self._client = client

    def _bucket(self):
        if self._client is None:
            try:
                self._client = gcs.Client()
            except Exception as error:  # credential/ADC resolution failure
                raise DocumentStorageError(
                    "Could not create a Google Cloud Storage client"
                ) from error
        return self._client.bucket(_require_bucket_name(self._configured_bucket_name))

    def save(
        self,
        *,
        marketplace_id: uuid.UUID,
        application_id: uuid.UUID,
        document_id: uuid.UUID,
        data: bytes,
    ) -> StoredDocument:
        bucket = self._bucket()
        object_key = (
            f"{_QUARANTINE_PREFIX}{marketplace_id}/{application_id}/{document_id}.pdf"
        )
        blob = bucket.blob(object_key)
        try:
            blob.upload_from_string(
                data,
                content_type=_CONTENT_TYPE,
                if_generation_match=0,
                timeout=60,
                checksum="crc32c",
            )
        except _BACKEND_ERRORS as error:
            raise DocumentStorageError(
                f"Could not upload document object {object_key}"
            ) from error
        return StoredDocument(
            bucket=bucket.name,
            object_key=object_key,
            size_bytes=len(data),
            sha256=hashlib.sha256(data).digest(),
            generation=getattr(blob, "generation", None),
        )

    def promote(
        self,
        *,
        object_key: str,
        generation: int,
        size_bytes: int,
        sha256: bytes,
    ) -> StoredDocument:
        object_key = _validate_object_key(object_key)
        if not object_key.startswith(_QUARANTINE_PREFIX):
            raise DocumentStorageError("Only quarantined objects can be promoted")
        clean_key = f"{_CLEAN_PREFIX}{object_key.removeprefix(_QUARANTINE_PREFIX)}"
        bucket = self._bucket()
        try:
            promoted = bucket.copy_blob(
                bucket.blob(object_key),
                bucket,
                clean_key,
                if_generation_match=0,
                if_source_generation_match=generation,
            )
        except _BACKEND_ERRORS as error:
            raise DocumentStorageError(
                "Could not promote the quarantined document object"
            ) from error
        promoted_generation = getattr(promoted, "generation", None)
        if promoted_generation is None:
            raise DocumentStorageError("Promoted document has no object generation")
        return StoredDocument(
            bucket=bucket.name,
            object_key=clean_key,
            size_bytes=size_bytes,
            sha256=sha256,
            generation=int(promoted_generation),
        )

    def delete(self, *, object_key: str, generation: int | None = None) -> None:
        _validate_object_key(object_key)
        bucket = self._bucket()
        try:
            kwargs = (
                {"if_generation_match": generation} if generation is not None else {}
            )
            bucket.blob(object_key).delete(**kwargs)
        except gcs_exceptions.NotFound:
            # Idempotent: the object is already gone, which is the desired
            # end state. Matches the filesystem backend's missing_ok delete.
            return
        except _BACKEND_ERRORS as error:
            raise DocumentStorageError(
                f"Could not delete document object {object_key}"
            ) from error
