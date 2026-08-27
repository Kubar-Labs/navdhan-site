from __future__ import annotations

import unittest
import uuid

from security.lookup_hash import normalize_identifier, tenant_lookup_digest


class TenantLookupDigestTests(unittest.TestCase):
    def setUp(self) -> None:
        self.key = bytes(range(32))
        self.first_tenant = uuid.UUID("00000000-0000-0000-0000-000000000001")
        self.second_tenant = uuid.UUID("00000000-0000-0000-0000-000000000002")

    def test_identifier_normalization_is_stable(self) -> None:
        self.assertEqual("ABCDE1234F", normalize_identifier(" abcde 1234-f "))

    def test_same_tenant_and_value_produce_same_digest(self) -> None:
        first = tenant_lookup_digest(self.key, self.first_tenant, "ABCDE1234F")
        second = tenant_lookup_digest(self.key, self.first_tenant, "ABCDE1234F")
        self.assertEqual(first, second)
        self.assertEqual(32, len(first))

    def test_digest_is_bound_to_tenant(self) -> None:
        first = tenant_lookup_digest(self.key, self.first_tenant, "ABCDE1234F")
        second = tenant_lookup_digest(self.key, self.second_tenant, "ABCDE1234F")
        self.assertNotEqual(first, second)

    def test_key_must_be_sufficiently_long(self) -> None:
        with self.assertRaises(ValueError):
            tenant_lookup_digest(b"short", self.first_tenant, "ABCDE1234F")


if __name__ == "__main__":
    unittest.main()
