"""Tenant-scoped digests for lookup of predictable identifiers."""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import uuid

_MINIMUM_KEY_BYTES = 32


def load_lookup_key() -> bytes:
    """Load and validate LOOKUP_HMAC_KEY from the environment.

    Raises RuntimeError with a clear message if the key is missing or
    malformed, instead of letting the first identifier lookup fail at runtime.
    """
    encoded = os.getenv("LOOKUP_HMAC_KEY")
    if not encoded:
        raise RuntimeError(
            "LOOKUP_HMAC_KEY env var is not set. Required for tenant-bound "
            "identifier lookup hashing."
        )
    try:
        key = base64.b64decode(encoded, validate=True)
    except ValueError as error:
        raise RuntimeError("LOOKUP_HMAC_KEY is not valid base64.") from error
    if len(key) < _MINIMUM_KEY_BYTES:
        raise RuntimeError(
            f"LOOKUP_HMAC_KEY must decode to at least {_MINIMUM_KEY_BYTES} bytes; "
            f"got {len(key)}."
        )
    return key


def normalize_identifier(value: str) -> str:
    """Return the canonical uppercase alphanumeric form of an identifier."""
    if not isinstance(value, str):
        raise TypeError("identifier must be a string")

    normalized = "".join(character for character in value.upper() if character.isalnum())
    if not normalized:
        raise ValueError("identifier must contain at least one alphanumeric character")
    return normalized


def tenant_lookup_digest(key: bytes, tenant_id: uuid.UUID, value: str) -> bytes:
    """Return an HMAC-SHA256 digest bound to a single tenant UUID."""
    if not isinstance(key, bytes):
        raise TypeError("key must be bytes")
    if len(key) < _MINIMUM_KEY_BYTES:
        raise ValueError("key must contain at least 32 bytes")
    if not isinstance(tenant_id, uuid.UUID):
        raise TypeError("tenant_id must be a UUID")

    message = tenant_id.bytes + normalize_identifier(value).encode("utf-8")
    return hmac.new(key, message, hashlib.sha256).digest()
