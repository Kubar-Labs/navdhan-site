"""
AES-256-GCM encryption for sensitive PII fields (Aadhaar number,
IT-portal passwords, PDF passwords, etc.).

Key comes from the ENCRYPTION_KEY env var — a 32-byte key base64-encoded.
In prod, the env var is populated by Cloud Run from Secret Manager.

Ciphertext format (base64-encoded):  [12-byte nonce | ciphertext | 16-byte tag]
Stored as a plain TEXT column.
"""

import base64
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

_NONCE_LEN = 12  # GCM recommended
_cached_key: bytes | None = None


def _key() -> bytes:
    """Lazy-load + validate the key on first use."""
    global _cached_key
    if _cached_key is not None:
        return _cached_key
    raw = os.getenv("ENCRYPTION_KEY")
    if not raw:
        raise RuntimeError(
            "ENCRYPTION_KEY env var is not set. Required to encrypt PII fields."
        )
    try:
        key = base64.b64decode(raw, validate=True)
    except ValueError as error:
        raise RuntimeError("ENCRYPTION_KEY is not valid base64") from error
    if len(key) != 32:
        raise RuntimeError(
            f"ENCRYPTION_KEY must decode to 32 bytes (AES-256); got {len(key)}"
        )
    _cached_key = key
    return key


def require_key() -> None:
    """Validate ENCRYPTION_KEY eagerly (e.g. at process startup).

    Raises RuntimeError with a clear message if the key is missing or
    malformed, instead of letting the first encrypted write fail at runtime.
    """
    _key()


def encrypt(plaintext: str) -> str:
    """Encrypt a string — returns base64(nonce || ciphertext || auth_tag)."""
    nonce = os.urandom(_NONCE_LEN)
    ct = AESGCM(_key()).encrypt(nonce, plaintext.encode("utf-8"), None)
    return base64.b64encode(nonce + ct).decode("ascii")


def decrypt(token: str) -> str:
    """Decrypt a value produced by encrypt(). Raises if tampered or wrong key."""
    blob = base64.b64decode(token, validate=True)
    nonce = blob[:_NONCE_LEN]
    ct = blob[_NONCE_LEN:]
    pt = AESGCM(_key()).decrypt(nonce, ct, None)
    return pt.decode("utf-8")
