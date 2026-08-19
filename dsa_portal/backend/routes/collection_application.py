"""HTTP routes for browser sessions and initial collection applications."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Annotated
import uuid

from fastapi import APIRouter, Header, HTTPException, status

from models.collection_application import (
    BusinessProfile,
    DigestHex,
    EntityPan,
    GstRegistration,
    LoanIntent,
    PartyDetails,
    PartyUpdate,
    PersonDetails,
    PersonalAadhaar,
    PersonalPan,
    SessionCreate,
)
from services.collection_application import (
    ApplicationLockedError,
    ApplicationNotStartedError,
    InvalidApplicationOperationError,
    InvalidSessionError,
    PartyNotFoundError,
    StaleApplicationError,
    create_application_party,
    create_session,
    get_current_application,
    save_business_profile,
    save_entity_pan,
    save_gst_registration,
    save_loan_intent,
    save_personal_aadhaar,
    save_personal_pan,
    save_primary_person,
    update_application_party,
)


router = APIRouter(prefix="/api/apply")
SessionDigest = Annotated[DigestHex | None, Header(alias="x-navdhan-session-digest")]


def _unauthorized() -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session")


def _locked() -> HTTPException:
    return HTTPException(status_code=409, detail="This application has already been submitted.")


async def _write(
    session_digest: DigestHex | None,
    operation: Callable[[bytes], Awaitable[dict[str, object]]],
) -> dict[str, object]:
    if session_digest is None:
        raise _unauthorized()
    try:
        return await operation(bytes.fromhex(session_digest))
    except InvalidSessionError as error:
        raise _unauthorized() from error
    except ApplicationNotStartedError as error:
        raise HTTPException(status_code=404, detail="Application not started") from error
    except PartyNotFoundError as error:
        raise HTTPException(status_code=404, detail="Application party not found") from error
    except ApplicationLockedError as error:
        raise _locked() from error
    except StaleApplicationError as error:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Application was updated; refresh and retry",
                "current_lock_version": error.current_lock_version,
            },
        ) from error
    except InvalidApplicationOperationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.post("/session", status_code=status.HTTP_201_CREATED)
async def post_session(payload: SessionCreate) -> dict[str, str]:
    try:
        browser_session = await create_session(bytes.fromhex(payload.token_digest))
    except InvalidSessionError as error:
        raise _unauthorized() from error
    return {"session_id": str(browser_session.session_id), "expires_at": browser_session.expires_at.isoformat()}


@router.get("/applications/current")
async def get_application(session_digest: SessionDigest = None) -> dict[str, object]:
    if session_digest is None:
        raise _unauthorized()
    try:
        return await get_current_application(bytes.fromhex(session_digest))
    except InvalidSessionError as error:
        raise _unauthorized() from error
    except ApplicationNotStartedError as error:
        raise HTTPException(status_code=404, detail="Application not started") from error


@router.put("/applications/current/loan-intent")
async def put_loan_intent(
    payload: LoanIntent, session_digest: SessionDigest = None
) -> dict[str, object]:
    if session_digest is None:
        raise _unauthorized()
    try:
        return await save_loan_intent(bytes.fromhex(session_digest), payload)
    except InvalidSessionError as error:
        raise _unauthorized() from error
    except ApplicationLockedError as error:
        raise _locked() from error
    except StaleApplicationError as error:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Application was updated; refresh and retry",
                "current_lock_version": error.current_lock_version,
            },
        ) from error
    except InvalidApplicationOperationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.put("/applications/current/business-profile")
async def put_business_profile(
    payload: BusinessProfile, session_digest: SessionDigest = None
) -> dict[str, object]:
    return await _write(
        session_digest, lambda digest: save_business_profile(digest, payload)
    )


@router.put("/applications/current/primary-person")
async def put_primary_person(
    payload: PersonDetails, session_digest: SessionDigest = None
) -> dict[str, object]:
    return await _write(
        session_digest, lambda digest: save_primary_person(digest, payload)
    )


@router.post("/applications/current/parties", status_code=status.HTTP_201_CREATED)
async def post_party(
    payload: PartyDetails, session_digest: SessionDigest = None
) -> dict[str, object]:
    return await _write(
        session_digest, lambda digest: create_application_party(digest, payload)
    )


@router.put("/applications/current/parties/{party_id}")
async def put_party(
    party_id: uuid.UUID,
    payload: PartyUpdate,
    session_digest: SessionDigest = None,
) -> dict[str, object]:
    return await _write(
        session_digest,
        lambda digest: update_application_party(digest, party_id, payload),
    )


@router.put("/applications/current/parties/{party_id}/identifiers/pan")
async def put_party_pan(
    party_id: uuid.UUID,
    payload: PersonalPan,
    session_digest: SessionDigest = None,
) -> dict[str, object]:
    return await _write(
        session_digest, lambda digest: save_personal_pan(digest, party_id, payload)
    )


@router.put("/applications/current/parties/{party_id}/identifiers/aadhaar")
async def put_party_aadhaar(
    party_id: uuid.UUID,
    payload: PersonalAadhaar,
    session_digest: SessionDigest = None,
) -> dict[str, object]:
    return await _write(
        session_digest,
        lambda digest: save_personal_aadhaar(digest, party_id, payload),
    )


@router.put("/applications/current/entity-pan")
async def put_entity_pan(
    payload: EntityPan, session_digest: SessionDigest = None
) -> dict[str, object]:
    return await _write(session_digest, lambda digest: save_entity_pan(digest, payload))


@router.put("/applications/current/gst-registration")
async def put_gst_registration(
    payload: GstRegistration, session_digest: SessionDigest = None
) -> dict[str, object]:
    return await _write(
        session_digest, lambda digest: save_gst_registration(digest, payload)
    )
