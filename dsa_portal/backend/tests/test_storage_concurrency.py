"""Regression coverage for blocking GCS calls in the async API runtime."""

from __future__ import annotations

import asyncio
import time
import unittest
from unittest.mock import patch

from services import collection_requirements


class StorageConcurrencyTests(unittest.IsolatedAsyncioTestCase):
    async def test_object_cleanup_does_not_block_the_event_loop(self) -> None:
        def slow_delete(*, object_key: str, generation: int | None = None) -> None:
            del object_key, generation
            time.sleep(0.1)

        with patch.object(
            collection_requirements._STORAGE,
            "delete",
            side_effect=slow_delete,
        ):
            cleanup = asyncio.create_task(
                collection_requirements._remove_stored_objects(
                    [("quarantine/test.pdf", 1)]
                )
            )
            await asyncio.sleep(0.01)

            self.assertFalse(
                cleanup.done(),
                "the event loop was blocked until the synchronous storage call finished",
            )
            await cleanup


if __name__ == "__main__":
    unittest.main()
