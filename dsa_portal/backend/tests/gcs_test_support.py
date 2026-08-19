"""Small in-memory subset of google-cloud-storage used by backend tests."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from google.api_core import exceptions as gcs_exceptions


@dataclass
class FakeGCSBucket:
    name: str
    objects: dict[str, bytes] = field(default_factory=dict)
    generations: dict[str, int] = field(default_factory=dict)
    _next_generation: int = 1

    def _write(self, object_key: str, data: bytes) -> int:
        generation = self._next_generation
        self._next_generation += 1
        self.objects[object_key] = data
        self.generations[object_key] = generation
        return generation

    def blob(self, object_key: str) -> "FakeGCSBlob":
        return FakeGCSBlob(self, object_key)

    def copy_blob(
        self,
        source: "FakeGCSBlob",
        destination_bucket: "FakeGCSBucket",
        new_name: str,
        **kwargs: Any,
    ) -> "FakeGCSBlob":
        expected_generation = kwargs.get("if_source_generation_match")
        actual_generation = self.generations.get(source.name)
        if source.name not in self.objects:
            raise gcs_exceptions.NotFound("source object does not exist")
        if expected_generation is not None and expected_generation != actual_generation:
            raise gcs_exceptions.PreconditionFailed("source generation changed")
        destination_generation = kwargs.get("if_generation_match")
        if destination_generation == 0 and new_name in destination_bucket.objects:
            raise gcs_exceptions.PreconditionFailed("destination object already exists")
        destination = destination_bucket.blob(new_name)
        destination.generation = destination_bucket._write(
            new_name, self.objects[source.name]
        )
        return destination


class FakeGCSBlob:
    def __init__(self, bucket: FakeGCSBucket, name: str) -> None:
        self.bucket = bucket
        self.name = name
        self.generation = bucket.generations.get(name)

    def upload_from_string(
        self, data: bytes, *, content_type: str, **kwargs: Any
    ) -> None:
        del content_type
        if kwargs.get("if_generation_match") == 0 and self.name in self.bucket.objects:
            raise gcs_exceptions.PreconditionFailed("object already exists")
        self.generation = self.bucket._write(self.name, bytes(data))

    def delete(self, **kwargs: Any) -> None:
        expected_generation = kwargs.get("if_generation_match")
        if self.name not in self.bucket.objects:
            raise gcs_exceptions.NotFound("object does not exist")
        actual_generation = self.bucket.generations[self.name]
        if expected_generation is not None and expected_generation != actual_generation:
            raise gcs_exceptions.PreconditionFailed("object generation changed")
        del self.bucket.objects[self.name]
        del self.bucket.generations[self.name]


class FakeGCSClient:
    def __init__(self) -> None:
        self.buckets: dict[str, FakeGCSBucket] = {}

    def bucket(self, name: str) -> FakeGCSBucket:
        return self.buckets.setdefault(name, FakeGCSBucket(name=name))
