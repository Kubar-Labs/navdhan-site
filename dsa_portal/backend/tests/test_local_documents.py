"""Unit tests for LocalDocumentStorage: PDF validation and delete containment.

No database connection — pure filesystem/validation logic.
"""

from __future__ import annotations

import os
import tempfile
import unittest
import uuid
from pathlib import Path

from storage.local_documents import (
    DocumentEmptyError,
    DocumentInvalidPdfError,
    DocumentPathTraversalError,
    DocumentTooLargeError,
    LocalDocumentStorage,
    validate_pdf_bytes,
)

MINIMAL_PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"


class ValidatePdfBytesTests(unittest.TestCase):
    def test_rejects_empty_file(self) -> None:
        with self.assertRaises(DocumentEmptyError):
            validate_pdf_bytes(b"", mime_type="application/pdf", filename="doc.pdf", max_size_bytes=100)

    def test_rejects_oversized_file(self) -> None:
        with self.assertRaises(DocumentTooLargeError):
            validate_pdf_bytes(
                MINIMAL_PDF, mime_type="application/pdf", filename="doc.pdf", max_size_bytes=4
            )

    def test_rejects_wrong_mime_type(self) -> None:
        with self.assertRaises(DocumentInvalidPdfError):
            validate_pdf_bytes(
                MINIMAL_PDF, mime_type="image/png", filename="doc.pdf", max_size_bytes=1_000
            )

    def test_rejects_wrong_extension(self) -> None:
        with self.assertRaises(DocumentInvalidPdfError):
            validate_pdf_bytes(
                MINIMAL_PDF, mime_type="application/pdf", filename="doc.txt", max_size_bytes=1_000
            )

    def test_rejects_missing_filename(self) -> None:
        with self.assertRaises(DocumentInvalidPdfError):
            validate_pdf_bytes(
                MINIMAL_PDF, mime_type="application/pdf", filename=None, max_size_bytes=1_000
            )

    def test_extension_check_is_case_insensitive(self) -> None:
        validate_pdf_bytes(
            MINIMAL_PDF, mime_type="application/pdf", filename="DOC.PDF", max_size_bytes=1_000
        )

    def test_rejects_bad_pdf_signature(self) -> None:
        with self.assertRaises(DocumentInvalidPdfError):
            validate_pdf_bytes(
                b"not a pdf at all, but long enough",
                mime_type="application/pdf",
                filename="doc.pdf",
                max_size_bytes=1_000,
            )

    def test_rejects_truncated_pdf_without_trailer(self) -> None:
        with self.assertRaises(DocumentInvalidPdfError):
            validate_pdf_bytes(
                b"%PDF-1.4\n1 0 obj<<>>endobj\n",
                mime_type="application/pdf",
                filename="doc.pdf",
                max_size_bytes=1_000,
            )

    def test_accepts_a_minimal_structurally_valid_pdf(self) -> None:
        validate_pdf_bytes(
            MINIMAL_PDF, mime_type="application/pdf", filename="doc.pdf", max_size_bytes=1_000
        )


class LocalDocumentStorageTests(unittest.TestCase):
    def setUp(self) -> None:
        self._previous_root = os.environ.get("LOCAL_DOCUMENT_STORAGE_ROOT")
        self._temp_dir = tempfile.mkdtemp(prefix="navdhan-storage-tests-")
        os.environ["LOCAL_DOCUMENT_STORAGE_ROOT"] = self._temp_dir
        self.storage = LocalDocumentStorage()
        self.marketplace_id = uuid.uuid4()
        self.application_id = uuid.uuid4()

    def tearDown(self) -> None:
        if self._previous_root is None:
            os.environ.pop("LOCAL_DOCUMENT_STORAGE_ROOT", None)
        else:
            os.environ["LOCAL_DOCUMENT_STORAGE_ROOT"] = self._previous_root

    def test_save_writes_under_the_configured_root_and_returns_metadata(self) -> None:
        document_id = uuid.uuid4()
        stored = self.storage.save(
            marketplace_id=self.marketplace_id,
            application_id=self.application_id,
            document_id=document_id,
            data=MINIMAL_PDF,
        )

        expected_path = (
            Path(self._temp_dir)
            / str(self.marketplace_id)
            / str(self.application_id)
            / f"{document_id}.pdf"
        )
        self.assertTrue(expected_path.exists())
        self.assertEqual(len(MINIMAL_PDF), stored.size_bytes)
        self.assertEqual("local", stored.bucket)

    def test_delete_removes_a_valid_path(self) -> None:
        document_id = uuid.uuid4()
        stored = self.storage.save(
            marketplace_id=self.marketplace_id,
            application_id=self.application_id,
            document_id=document_id,
            data=MINIMAL_PDF,
        )
        path = Path(self._temp_dir) / stored.object_key
        self.assertTrue(path.exists())

        self.storage.delete(object_key=stored.object_key)

        self.assertFalse(path.exists())

    def test_delete_is_idempotent_for_a_missing_path(self) -> None:
        self.storage.delete(
            object_key=f"{self.marketplace_id}/{self.application_id}/{uuid.uuid4()}.pdf"
        )  # must not raise

    def test_delete_rejects_parent_directory_traversal(self) -> None:
        with self.assertRaises(DocumentPathTraversalError):
            self.storage.delete(object_key="../../escape.pdf")

    def test_delete_rejects_an_absolute_path_outside_the_root(self) -> None:
        outside = str(Path(tempfile.gettempdir()) / "evil.pdf")
        with self.assertRaises(DocumentPathTraversalError):
            self.storage.delete(object_key=outside)

    def test_delete_traversal_attempt_does_not_touch_a_file_outside_the_root(self) -> None:
        sentinel_dir = tempfile.mkdtemp(prefix="navdhan-sentinel-")
        sentinel = Path(sentinel_dir) / "must-survive.txt"
        sentinel.write_text("do not delete me")

        traversal_key = os.path.relpath(sentinel, start=self._temp_dir)
        with self.assertRaises(DocumentPathTraversalError):
            self.storage.delete(object_key=traversal_key)

        self.assertTrue(sentinel.exists())


if __name__ == "__main__":
    unittest.main()
