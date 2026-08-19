from __future__ import annotations

from types import SimpleNamespace
import unittest
import uuid

from services.collection_requirements import _compute_status
from storage.documents import DocumentStorageError
from storage.gcs import GCSStorage
from tests.gcs_test_support import FakeGCSClient


class DocumentQuarantineTests(unittest.TestCase):
    def test_only_clean_uploaded_documents_can_satisfy_a_requirement(self) -> None:
        requirement = SimpleNamespace(
            coverage_mode="none",
            min_count=1,
            fiscal_year_start=None,
            required_period_from=None,
            required_period_to=None,
        )

        for status, scan_result in (
            ("quarantined", "pending"),
            ("scan_failed", "infected"),
            ("scan_failed", "unreadable"),
            ("uploaded", "pending"),
        ):
            with self.subTest(status=status, scan_result=scan_result):
                document = SimpleNamespace(
                    status=status,
                    scan_result=scan_result,
                    fiscal_year_start=None,
                    coverage_from=None,
                    coverage_to=None,
                )
                self.assertEqual("pending", _compute_status(requirement, [document]))

        clean = SimpleNamespace(
            status="uploaded",
            scan_result="clean",
            fiscal_year_start=None,
            coverage_from=None,
            coverage_to=None,
        )
        self.assertEqual("collected", _compute_status(requirement, [clean]))

    def test_uploads_land_in_quarantine_and_promotion_is_generation_bound(self) -> None:
        client = FakeGCSClient()
        storage = GCSStorage(bucket_name="documents-test", client=client)
        marketplace_id = uuid.uuid4()
        application_id = uuid.uuid4()
        document_id = uuid.uuid4()

        stored = storage.save(
            marketplace_id=marketplace_id,
            application_id=application_id,
            document_id=document_id,
            data=b"%PDF-1.4\n%%EOF",
        )

        self.assertTrue(stored.object_key.startswith("quarantine/"))
        with self.assertRaises(DocumentStorageError):
            storage.save(
                marketplace_id=marketplace_id,
                application_id=application_id,
                document_id=document_id,
                data=b"%PDF-1.4\nreplacement\n%%EOF",
            )
        self.assertEqual(
            b"%PDF-1.4\n%%EOF",
            client.bucket("documents-test").objects[stored.object_key],
        )
        with self.assertRaises(Exception):
            storage.promote(
                object_key=stored.object_key,
                generation=(stored.generation or 0) + 1,
                size_bytes=stored.size_bytes,
                sha256=stored.sha256,
            )

        promoted = storage.promote(
            object_key=stored.object_key,
            generation=stored.generation,
            size_bytes=stored.size_bytes,
            sha256=stored.sha256,
        )
        self.assertTrue(promoted.object_key.startswith("clean/"))
        self.assertIn(promoted.object_key, client.bucket("documents-test").objects)
        with self.assertRaises(Exception):
            storage.promote(
                object_key=stored.object_key,
                generation=stored.generation,
                size_bytes=stored.size_bytes,
                sha256=stored.sha256,
            )
