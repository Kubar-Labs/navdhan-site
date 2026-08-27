from __future__ import annotations

import asyncio
import os
import unittest
from unittest.mock import patch
from uuid import UUID

from providers import (
    DisabledVerificationProvider,
    VerificationProviderUnavailable,
    get_verification_provider,
)
from settings import ConfigurationError, load_settings


class VerificationProviderBoundaryTests(unittest.TestCase):
    def test_runtime_configuration_cannot_activate_an_unreviewed_adapter(self) -> None:
        with patch.dict(
            os.environ,
            {"APP_ENV": "dev", "VERIFICATION_PROVIDER_MODE": "live"},
            clear=True,
        ):
            with self.assertRaisesRegex(ConfigurationError, "must remain 'disabled'"):
                load_settings()

    def test_disabled_is_the_only_registered_mode(self) -> None:
        self.assertIsInstance(
            get_verification_provider("disabled"), DisabledVerificationProvider
        )
        with self.assertRaisesRegex(
            VerificationProviderUnavailable, "No approved verification provider"
        ):
            get_verification_provider("live")

    def test_disabled_adapter_cannot_start_or_accept_a_callback(self) -> None:
        provider = DisabledVerificationProvider()

        async def exercise() -> None:
            with self.assertRaises(VerificationProviderUnavailable):
                await provider.start_hosted_session(
                    marketplace_id=UUID("10000000-0000-4000-8000-000000000001"),
                    application_id=UUID("20000000-0000-4000-8000-000000000001"),
                    callback_url="https://navdhan.app/api/provider/callback",
                )
            with self.assertRaises(VerificationProviderUnavailable):
                await provider.verify_signed_callback(body=b"{}", headers={})

        asyncio.run(exercise())


if __name__ == "__main__":
    unittest.main()
