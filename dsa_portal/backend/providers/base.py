"""Interfaces for future, provider-hosted verification integrations.

No live adapter is shipped. Adding one requires a reviewed provider contract,
provider-hosted consent, signed callback verification, staging acceptance, and
a separately approved change to this registry.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping, Protocol
from uuid import UUID


class VerificationProviderUnavailable(RuntimeError):
    """Raised when an integration is disabled or not configured."""


@dataclass(frozen=True)
class ProviderSession:
    provider_reference: str
    redirect_url: str
    expires_at_iso: str


class VerificationProvider(Protocol):
    async def start_hosted_session(
        self,
        *,
        marketplace_id: UUID,
        application_id: UUID,
        callback_url: str,
    ) -> ProviderSession: ...

    async def verify_signed_callback(
        self,
        *,
        body: bytes,
        headers: Mapping[str, str],
    ) -> Mapping[str, object]: ...


class DisabledVerificationProvider:
    """The only registered adapter until an approved provider goes live."""

    async def start_hosted_session(
        self,
        *,
        marketplace_id: UUID,
        application_id: UUID,
        callback_url: str,
    ) -> ProviderSession:
        del marketplace_id, application_id, callback_url
        raise VerificationProviderUnavailable("Verification providers are disabled")

    async def verify_signed_callback(
        self,
        *,
        body: bytes,
        headers: Mapping[str, str],
    ) -> Mapping[str, object]:
        del body, headers
        raise VerificationProviderUnavailable("Verification providers are disabled")


def get_verification_provider(mode: str) -> VerificationProvider:
    """Resolve only reviewed adapters; unknown modes fail closed."""

    if mode == "disabled":
        return DisabledVerificationProvider()
    raise VerificationProviderUnavailable(
        f"No approved verification provider adapter is registered for {mode!r}"
    )
