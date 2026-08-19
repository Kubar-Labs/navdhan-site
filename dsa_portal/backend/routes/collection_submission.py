"""HTTP routes for Phase 5: consent grants and final submission."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, status

from models.collection_application import DigestHex
from models.collection_submission import ConsentGrantWrite, SubmitRequest
from services.collection_application import (
    ApplicationLockedError,
    ApplicationNotStartedError,
    InvalidApplicationOperationError,
    InvalidSessionError,
    StaleApplicationError,
)
from services.collection_submission import (
    SubmissionIncompleteError,
    get_consent_status,
    save_consent_grants,
    submit_application,
)


router = APIRouter(prefix="/api/apply")
SessionDigest = Annotated[DigestHex | None, Header(alias="x-navdhan-session-digest")]


def _unauthorized() -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session")


def _not_found(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


def _locked() -> HTTPException:
    return HTTPException(status_code=409, detail="This application has already been submitted.")


def _stale(error: StaleApplicationError) -> HTTPException:
    return HTTPException(
        status_code=409,
        detail={
            "message": "Application was updated; refresh and retry",
            "current_lock_version": error.current_lock_version,
        },
    )


def _incomplete(error: SubmissionIncompleteError) -> HTTPException:
    return HTTPException(
        status_code=422,
        detail={
            "message": "Application is not complete",
            "missing": error.missing,
        },
    )


@router.get("/applications/current/consent")
async def get_application_consent(session_digest: SessionDigest = None) -> dict[str, object]:
    if session_digest is None:
        raise _unauthorized()
    try:
        return await get_consent_status(bytes.fromhex(session_digest))
    except InvalidSessionError as error:
        raise _unauthorized() from error
    except ApplicationNotStartedError as error:
        raise _not_found("Application not started") from error


@router.put("/applications/current/consent")
async def put_application_consent(
    payload: ConsentGrantWrite, session_digest: SessionDigest = None
) -> dict[str, object]:
    if session_digest is None:
        raise _unauthorized()
    try:
        return await save_consent_grants(bytes.fromhex(session_digest), payload)
    except InvalidSessionError as error:
        raise _unauthorized() from error
    except ApplicationNotStartedError as error:
        raise _not_found("Application not started") from error
    except ApplicationLockedError as error:
        raise _locked() from error
    except StaleApplicationError as error:
        raise _stale(error) from error
    except InvalidApplicationOperationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.post("/applications/current/submit")
async def post_application_submit(
    payload: SubmitRequest, session_digest: SessionDigest = None
) -> dict[str, object]:
    if session_digest is None:
        raise _unauthorized()
    try:
        return await submit_application(bytes.fromhex(session_digest), payload)
    except InvalidSessionError as error:
        raise _unauthorized() from error
    except ApplicationNotStartedError as error:
        raise _not_found("Application not started") from error
    except StaleApplicationError as error:
        raise _stale(error) from error
    except SubmissionIncompleteError as error:
        raise _incomplete(error) from error
