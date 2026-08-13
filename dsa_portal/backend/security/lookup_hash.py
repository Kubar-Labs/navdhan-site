"""Tenant-scoped digests for lookup of predictable identifiers."""

from __future__ import annotations

import hashlib
import hmac
import uuid

_MINIMUM_KEY_BYTES = 32


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
