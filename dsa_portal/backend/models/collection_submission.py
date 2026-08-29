"""Validated request/response contracts for Phase 5 (consent, submission)."""

from __future__ import annotations

from models.collection_application import VersionedCollectionRequest


class ConsentGrantWrite(VersionedCollectionRequest):
    """Borrower's consent decisions, keyed by consent purpose code.

    Any purpose omitted from the map is treated as not granted. Mandatory
    purposes missing or explicitly false are rejected by the service.
    """

    grants: dict[str, bool]


class SubmitRequest(VersionedCollectionRequest):
    pass
