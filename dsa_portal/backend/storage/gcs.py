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
        object_key = f"{marketplace_id}/{application_id}/{document_id}.pdf"
        blob = bucket.blob(object_key)
        try:
            blob.upload_from_string(data, content_type=_CONTENT_TYPE)
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

    def delete(self, *, object_key: str) -> None:
        _validate_object_key(object_key)
        bucket = self._bucket()
        try:
            bucket.blob(object_key).delete()
        except gcs_exceptions.NotFound:
            # Idempotent: the object is already gone, which is the desired
            # end state. Matches the filesystem backend's missing_ok delete.
            return
        except _BACKEND_ERRORS as error:
            raise DocumentStorageError(
                f"Could not delete document object {object_key}"
            ) from error
