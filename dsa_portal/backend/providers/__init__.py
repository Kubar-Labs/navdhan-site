"""Fail-closed verification provider boundary.

Only provider-hosted consent journeys may implement this contract. The
collection service never accepts or stores tax-portal or banking passwords.
"""

from .base import (
    DisabledVerificationProvider,
    ProviderSession,
    VerificationProvider,
    VerificationProviderUnavailable,
    get_verification_provider,
)

__all__ = [
    "DisabledVerificationProvider",
    "ProviderSession",
    "VerificationProvider",
    "VerificationProviderUnavailable",
    "get_verification_provider",
]
