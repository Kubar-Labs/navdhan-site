"""HTTP routes for Phase 4: requirements, documents, and existing-credit facilities."""

from __future__ import annotations

from datetime import date
from typing import Annotated
import uuid

from fastapi import APIRouter, Form, Header, HTTPException, UploadFile, status

from models.collection_application import DigestHex
from models.collection_requirements import (
    CreditDeclaration,
    CreditFacility,
    DocumentScanResult,
)
from services.collection_application import (
    ApplicationLockedError,
    ApplicationNotStartedError,
    InvalidApplicationOperationError,
    InvalidSessionError,
    StaleApplicationError,
)
from services.collection_requirements import (
    DocumentNotFoundError,
    DocumentScanIntegrityError,
    DocumentScanStorageError,
    DocumentScanTransitionError,
    DocumentValidationError,
    RequirementNotFoundError,
    create_credit_facility,
    delete_document,
    get_requirements,
    record_document_scan_result,
    save_credit_declaration,
    upload_document,
)


router = APIRouter(prefix="/api/apply")
internal_router = APIRouter(prefix="/internal")
SessionDigest = Annotated[DigestHex | None, Header(alias="x-navdhan-session-digest")]

MAX_UPLOAD_BYTES = 20 * 1024 * 1024


@internal_router.post("/document-scans/{document_id}/result")
async def post_document_scan_result(
    document_id: uuid.UUID,
    payload: DocumentScanResult,
) -> dict[str, object]:
    """Apply a scanner verdict after middleware authenticates the callback."""
    try:
        return await record_document_scan_result(document_id, payload)
    except DocumentNotFoundError as error:
        raise _not_found("Document not found") from error
    except DocumentScanIntegrityError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except DocumentScanTransitionError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except DocumentScanStorageError as error:
        raise HTTPException(
            status_code=503, detail="Document promotion failed"
        ) from error


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session"
    )


def _not_found(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


def _locked() -> HTTPException:
    return HTTPException(
        status_code=409, detail="This application has already been submitted."
    )


def _stale(error: StaleApplicationError) -> HTTPException:
    return HTTPException(
        status_code=409,
        detail={
            "message": "Application was updated; refresh and retry",
            "current_lock_version": error.current_lock_version,
        },
    )


@router.get("/applications/current/requirements")
async def get_application_requirements(
    session_digest: SessionDigest = None,
) -> dict[str, object]:
    if session_digest is None:
        raise _unauthorized()
    try:
        return await get_requirements(bytes.fromhex(session_digest))
    except InvalidSessionError as error:
        raise _unauthorized() from error
    except ApplicationNotStartedError as error:
        raise _not_found("Application not started") from error


@router.put("/applications/current/credit-declaration")
async def put_credit_declaration(
    payload: CreditDeclaration, session_digest: SessionDigest = None
) -> dict[str, object]:
    if session_digest is None:
        raise _unauthorized()
    try:
        return await save_credit_declaration(bytes.fromhex(session_digest), payload)
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


@router.get("/applications/current/credit-facilities")
async def get_credit_facilities(
    session_digest: SessionDigest = None,
) -> dict[str, object]:
    if session_digest is None:
        raise _unauthorized()
    try:
        return await get_requirements(bytes.fromhex(session_digest))
    except InvalidSessionError as error:
        raise _unauthorized() from error
    except ApplicationNotStartedError as error:
        raise _not_found("Application not started") from error


@router.post(
    "/applications/current/credit-facilities", status_code=status.HTTP_201_CREATED
)
async def post_credit_facility(
    payload: CreditFacility, session_digest: SessionDigest = None
) -> dict[str, object]:
    if session_digest is None:
        raise _unauthorized()
    try:
        return await create_credit_facility(bytes.fromhex(session_digest), payload)
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


def _parse_uuid(value: str, field: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=f"Invalid {field}") from error


def _parse_optional_date(value: str | None, field: str) -> date | None:
    if value is None or value == "":
        return None
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=f"Invalid {field}") from error


@router.post("/applications/current/documents", status_code=status.HTTP_201_CREATED)
async def post_document(
    file: UploadFile,
    application_requirement_id: Annotated[str, Form()],
    expected_lock_version: Annotated[int, Form()],
    coverage_from: Annotated[str | None, Form()] = None,
    coverage_to: Annotated[str | None, Form()] = None,
    supersedes_document_id: Annotated[str | None, Form()] = None,
    session_digest: SessionDigest = None,
) -> dict[str, object]:
    if session_digest is None:
        raise _unauthorized()
    if expected_lock_version < 0:
        raise HTTPException(status_code=422, detail="Invalid expected_lock_version")

    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File is too large")

    requirement_id = _parse_uuid(
        application_requirement_id, "application_requirement_id"
    )
    supersedes_uuid = (
        _parse_uuid(supersedes_document_id, "supersedes_document_id")
        if supersedes_document_id
        else None
    )
    coverage_from_date = _parse_optional_date(coverage_from, "coverage_from")
    coverage_to_date = _parse_optional_date(coverage_to, "coverage_to")

    try:
        return await upload_document(
            bytes.fromhex(session_digest),
            application_requirement_id=requirement_id,
            expected_lock_version=expected_lock_version,
            file_bytes=data,
            mime_type=file.content_type or "application/octet-stream",
            filename=file.filename,
            coverage_from=coverage_from_date,
            coverage_to=coverage_to_date,
            supersedes_document_id=supersedes_uuid,
        )
    except InvalidSessionError as error:
        raise _unauthorized() from error
    except ApplicationNotStartedError as error:
        raise _not_found("Application not started") from error
    except (RequirementNotFoundError, DocumentNotFoundError) as error:
        raise _not_found("Requirement or document not found") from error
    except ApplicationLockedError as error:
        raise _locked() from error
    except StaleApplicationError as error:
        raise _stale(error) from error
    except DocumentValidationError as error:
        raise HTTPException(
            status_code=422, detail=str(error) or "Invalid document"
        ) from error
    except InvalidApplicationOperationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.delete("/applications/current/documents/{document_id}")
async def delete_application_document(
    document_id: uuid.UUID,
    expected_lock_version: int,
    session_digest: SessionDigest = None,
) -> dict[str, object]:
    if session_digest is None:
        raise _unauthorized()
    try:
        return await delete_document(
            bytes.fromhex(session_digest), document_id, expected_lock_version
        )
    except InvalidSessionError as error:
        raise _unauthorized() from error
    except ApplicationNotStartedError as error:
        raise _not_found("Application not started") from error
    except DocumentNotFoundError as error:
        raise _not_found("Document not found") from error
    except ApplicationLockedError as error:
        raise _locked() from error
    except StaleApplicationError as error:
        raise _stale(error) from error
