from __future__ import annotations

import hashlib
import json as jsonlib
import os
import subprocess
import tempfile
import unittest
import uuid
from dataclasses import dataclass
from pathlib import Path
from unittest.mock import Mock, patch

from google.api_core import exceptions as gcs_exceptions

from scanner_app import (
    ScannerUnavailableError,
    Settings,
    _download_exact_generation,
    _post_verdict,
    _scan_file,
    create_app,
    load_settings,
)


BUCKET = "navdhan-documents-staging"
BACKEND = "https://backend.example"
TOKEN = "scanner-callback-token-at-least-32-bytes"


async def run_inline(function: object, *args: object, **kwargs: object) -> object:
    return function(*args, **kwargs)  # type: ignore[operator]


@dataclass(frozen=True)
class TestResponse:
    status_code: int
    body: bytes

    @property
    def text(self) -> str:
        return self.body.decode("utf-8")

    def json(self) -> object:
        return jsonlib.loads(self.body)


class FakeBlob:
    def __init__(self, data: bytes) -> None:
        self.data = data

    def download_to_filename(self, filename: str, **kwargs: object) -> None:
        Path(filename).write_bytes(self.data)


class FakeBucket:
    def __init__(self, data: bytes) -> None:
        self.data = data

    def blob(self, name: str, generation: int) -> FakeBlob:
        return FakeBlob(self.data)


class FakeStorage:
    def __init__(self, data: bytes) -> None:
        self.data = data

    def bucket(self, name: str) -> FakeBucket:
        return FakeBucket(self.data)


class MissingBlob:
    def download_to_filename(self, filename: str, **kwargs: object) -> None:
        raise gcs_exceptions.NotFound("already removed")


class MissingBucket:
    def blob(self, name: str, generation: int) -> MissingBlob:
        return MissingBlob()


class MissingStorage:
    def bucket(self, name: str) -> MissingBucket:
        return MissingBucket()


class ScannerAppTests(unittest.IsolatedAsyncioTestCase):
    def _app(self, *, verdict: str = "clean", data: bytes = b"%PDF test\n"):
        callback = Mock()
        app = create_app(
            settings_loader=lambda: Settings(BUCKET, BACKEND, TOKEN),
            storage_client_factory=lambda: FakeStorage(data),
            scan_file=lambda _: verdict,
            post_verdict=callback,
            run_sync=run_inline,
        )
        return app, callback, data

    async def _post(
        self,
        app: object,
        *,
        headers: dict[str, str],
        json: dict[str, object],
    ) -> TestResponse:
        body = jsonlib.dumps(json).encode("utf-8")
        request_pending = True
        messages: list[dict[str, object]] = []

        async def receive() -> dict[str, object]:
            nonlocal request_pending
            if request_pending:
                request_pending = False
                return {"type": "http.request", "body": body, "more_body": False}
            return {"type": "http.disconnect"}

        async def send(message: dict[str, object]) -> None:
            messages.append(message)

        scope = {
            "type": "http",
            "asgi": {"version": "3.0", "spec_version": "2.3"},
            "http_version": "1.1",
            "method": "POST",
            "scheme": "http",
            "path": "/",
            "raw_path": b"/",
            "query_string": b"",
            "root_path": "",
            "headers": [
                (key.lower().encode(), value.encode())
                for key, value in {
                    **headers,
                    "content-type": "application/json",
                    "content-length": str(len(body)),
                }.items()
            ],
            "client": ("127.0.0.1", 1234),
            "server": ("scanner.test", 80),
        }
        await app(scope, receive, send)  # type: ignore[operator]

        start = next(message for message in messages if message["type"] == "http.response.start")
        response_body = b"".join(
            message.get("body", b"")  # type: ignore[arg-type]
            for message in messages
            if message["type"] == "http.response.body"
        )
        return TestResponse(int(start["status"]), response_body)

    def _event(self, data: bytes, *, name: str | None = None) -> dict[str, object]:
        return {
            "bucket": BUCKET,
            "name": name
            or f"quarantine/{uuid.uuid4()}/{uuid.uuid4()}/{uuid.uuid4()}.pdf",
            "generation": "42",
            "size": str(len(data)),
        }

    def _headers(
        self, event: dict[str, object], *, event_id: str = "event-123"
    ) -> dict[str, str]:
        return {
            "ce-specversion": "1.0",
            "ce-type": "google.cloud.storage.object.v1.finalized",
            "ce-source": f"//storage.googleapis.com/projects/_/buckets/{BUCKET}",
            "ce-subject": f"objects/{event['name']}",
            "ce-id": event_id,
        }

    async def test_clean_verdict_binds_exact_generation_digest_and_event(self) -> None:
        app, callback, data = self._app()
        event = self._event(data)
        response = await self._post(
            app,
            headers=self._headers(event),
            json=event,
        )

        self.assertEqual(200, response.status_code, response.text)
        self.assertEqual({"status": "clean"}, response.json())
        callback.assert_called_once()
        kwargs = callback.call_args.kwargs
        self.assertEqual(42, kwargs["generation"])
        self.assertEqual(hashlib.sha256(data).hexdigest(), kwargs["digest"])
        self.assertEqual("event-123", kwargs["event_id"])
        self.assertEqual("clean", kwargs["verdict"])

    async def test_infected_and_unreadable_are_terminal_verdicts(self) -> None:
        for verdict in ("infected", "unreadable"):
            with self.subTest(verdict=verdict):
                app, callback, data = self._app(verdict=verdict)
                event = self._event(data)
                response = await self._post(
                    app,
                    headers=self._headers(event, event_id=f"event-{verdict}"),
                    json=event,
                )
                self.assertEqual(200, response.status_code, response.text)
                self.assertEqual(verdict, callback.call_args.kwargs["verdict"])

    async def test_non_quarantine_objects_are_ignored_without_callback(self) -> None:
        app, callback, data = self._app()
        event = self._event(data, name=f"clean/{uuid.uuid4()}.pdf")
        response = await self._post(
            app,
            headers=self._headers(event, event_id="event-clean-copy"),
            json=event,
        )
        self.assertEqual({"status": "ignored"}, response.json())
        callback.assert_not_called()

    async def test_missing_quarantine_generation_acknowledges_only_an_exact_replay(
        self,
    ) -> None:
        data = b"%PDF test\n"
        for processed, expected_status in ((True, 200), (False, 503)):
            with self.subTest(processed=processed):
                callback = Mock()
                replay_check = Mock(return_value=processed)
                app = create_app(
                    settings_loader=lambda: Settings(BUCKET, BACKEND, TOKEN),
                    storage_client_factory=MissingStorage,
                    scan_file=lambda _: "clean",
                    post_verdict=callback,
                    scan_event_processed=replay_check,
                    run_sync=run_inline,
                )
                event = self._event(data)
                document_id = str(event["name"]).removesuffix(".pdf").rsplit("/", 1)[-1]
                response = await self._post(
                    app,
                    headers=self._headers(event, event_id="duplicate-event-123"),
                    json=event,
                )

                self.assertEqual(expected_status, response.status_code, response.text)
                if processed:
                    self.assertEqual({"status": "already_processed"}, response.json())
                replay_check.assert_called_once_with(
                    settings=Settings(BUCKET, BACKEND, TOKEN),
                    document_id=uuid.UUID(document_id),
                    generation=42,
                    event_id="duplicate-event-123",
                )
                callback.assert_not_called()

    async def test_wrong_bucket_event_type_and_size_fail_closed(self) -> None:
        app, callback, data = self._app()
        event = self._event(data)
        event["bucket"] = "another-bucket"
        wrong_bucket = await self._post(
            app,
            headers=self._headers(event, event_id="one"),
            json=event,
        )
        right_event = self._event(data)
        wrong_type_headers = self._headers(right_event, event_id="two")
        wrong_type_headers["ce-type"] = "other"
        wrong_type = await self._post(
            app,
            headers=wrong_type_headers,
            json=right_event,
        )
        bad_size = self._event(data)
        bad_size["size"] = "0"
        zero_size = await self._post(
            app,
            headers=self._headers(bad_size, event_id="three"),
            json=bad_size,
        )
        self.assertEqual(403, wrong_bucket.status_code)
        self.assertEqual(400, wrong_type.status_code)
        self.assertEqual(422, zero_size.status_code)
        callback.assert_not_called()

    async def test_cloud_event_source_subject_and_version_are_bound(self) -> None:
        app, callback, data = self._app()
        event = self._event(data)
        valid_headers = self._headers(event)

        for field, value, expected_status in (
            ("ce-specversion", "0.3", 400),
            ("ce-source", "//storage.googleapis.com/projects/_/buckets/other", 403),
            ("ce-subject", "objects/quarantine/other.pdf", 400),
        ):
            with self.subTest(field=field):
                headers = {**valid_headers, field: value}
                response = await self._post(app, headers=headers, json=event)
                self.assertEqual(expected_status, response.status_code, response.text)

        callback.assert_not_called()

    async def test_scan_or_callback_outage_returns_retryable_503(self) -> None:
        for failing_dependency, detail in (
            ("scan", "Scanner unavailable"),
            ("callback", "Callback unavailable"),
        ):
            with self.subTest(failing_dependency=failing_dependency):
                callback = Mock()
                if failing_dependency == "callback":
                    callback.side_effect = OSError("backend unavailable")

                def scan(_: Path) -> str:
                    if failing_dependency == "scan":
                        raise ScannerUnavailableError("engine unavailable")
                    return "clean"

                app = create_app(
                    settings_loader=lambda: Settings(BUCKET, BACKEND, TOKEN),
                    storage_client_factory=lambda: FakeStorage(b"%PDF test\n"),
                    scan_file=scan,
                    post_verdict=callback,
                    run_sync=run_inline,
                )
                event = self._event(b"%PDF test\n")
                response = await self._post(
                    app,
                    headers=self._headers(event),
                    json=event,
                )
                self.assertEqual(503, response.status_code, response.text)
                self.assertEqual(detail, response.json()["detail"])


class ScannerPrimitiveTests(unittest.TestCase):
    def test_download_is_pinned_to_exact_generation(self) -> None:
        client = Mock()
        blob = client.bucket.return_value.blob.return_value
        destination = Path(tempfile.gettempdir()) / "unused-scanner-test.pdf"

        _download_exact_generation(
            client=client,
            bucket_name=BUCKET,
            object_name="quarantine/a/b/c.pdf",
            generation=42,
            destination=destination,
        )

        client.bucket.assert_called_once_with(BUCKET)
        client.bucket.return_value.blob.assert_called_once_with(
            "quarantine/a/b/c.pdf", generation=42
        )
        blob.download_to_filename.assert_called_once_with(
            str(destination),
            if_generation_match=42,
            timeout=60,
            checksum="crc32c",
        )

    def test_clamav_clean_infected_and_infrastructure_results(self) -> None:
        with tempfile.NamedTemporaryFile(suffix=".pdf") as document:
            path = Path(document.name)
            for return_code, expected in ((0, "clean"), (1, "infected")):
                with self.subTest(return_code=return_code), patch(
                    "scanner_app.subprocess.run",
                    return_value=subprocess.CompletedProcess([], return_code),
                ) as run:
                    self.assertEqual(expected, _scan_file(path))
                    command = run.call_args.args[0]
                    self.assertIn("--official-db-only=yes", command)
                    self.assertIn("--fail-if-cvd-older-than=2", command)
                    self.assertIn("--alert-encrypted-doc=yes", command)
                    self.assertIn("--alert-exceeds-max=yes", command)

            with patch(
                "scanner_app.subprocess.run",
                return_value=subprocess.CompletedProcess([], 2),
            ):
                with self.assertRaises(ScannerUnavailableError):
                    _scan_file(path)

            with patch(
                "scanner_app.subprocess.run",
                side_effect=subprocess.TimeoutExpired("clamscan", 90),
            ):
                with self.assertRaises(ScannerUnavailableError):
                    _scan_file(path)

    def test_callback_contains_only_bound_verdict_evidence(self) -> None:
        settings = Settings(BUCKET, BACKEND, TOKEN)
        document_id = uuid.uuid4()
        response = Mock()
        with patch("scanner_app.httpx.post", return_value=response) as post:
            _post_verdict(
                settings=settings,
                document_id=document_id,
                generation=42,
                digest="a" * 64,
                event_id="event-123",
                verdict="clean",
            )

        post.assert_called_once_with(
            f"{BACKEND}/internal/document-scans/{document_id}/result",
            headers={"x-navdhan-scan-token": TOKEN},
            json={
                "scan_result": "clean",
                "gcs_generation": 42,
                "sha256": "a" * 64,
                "scanner_job_id": "event-123",
            },
            timeout=30,
        )
        response.raise_for_status.assert_called_once_with()

    def test_settings_reject_non_origin_backend_and_short_token(self) -> None:
        valid = {
            "GCS_BUCKET": BUCKET,
            "BACKEND_URL": BACKEND,
            "DOCUMENT_SCAN_CALLBACK_TOKEN": TOKEN,
        }
        with patch.dict(os.environ, valid, clear=True):
            self.assertEqual(BACKEND, load_settings().backend_url)

        for backend, token in (
            ("http://backend.example", TOKEN),
            ("https://user@backend.example", TOKEN),
            ("https://backend.example/path", TOKEN),
            (BACKEND, "short"),
        ):
            with self.subTest(backend=backend, token=token), patch.dict(
                os.environ,
                {
                    **valid,
                    "BACKEND_URL": backend,
                    "DOCUMENT_SCAN_CALLBACK_TOKEN": token,
                },
                clear=True,
            ):
                with self.assertRaises(RuntimeError):
                    load_settings()


if __name__ == "__main__":
    unittest.main()
