"""
Profit & Loss document upload — collect-only mode.

POST /pl/upload (multipart)
  - Accepts PDF or DOC/DOCX
  - Uploads to GCS permanently
  - Saves case_id + GCS URL to pl_verifications
  - No analysis at this stage
"""

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func

from db.models import PlVerification
from db.session import get_session
from services.verification import get_or_create_case
from storage.gcs import build_doc_path, upload_bytes

router = APIRouter(prefix="/pl", tags=["Profit & Loss"])

_ALLOWED_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
_ALLOWED_EXT = {".pdf", ".doc", ".docx"}


@router.post("/upload")
async def upload_pl(
    case_id: str          = Form(...),
    file:    UploadFile   = File(...),
    db:      AsyncSession = Depends(get_session),
):
    name = (file.filename or "").lower()
    ext  = next((e for e in _ALLOWED_EXT if name.endswith(e)), None)
    if not ext:
        raise HTTPException(400, "Only PDF, DOC, or DOCX files are accepted")

    content = await file.read()
    if not content:
        raise HTTPException(400, "Empty file")

    case = await get_or_create_case(db, case_id=case_id)

    gcs_path = build_doc_path(case_id, "pl_statement", file.filename or f"pl{ext}")
    up = await upload_bytes(
        gcs_path, content,
        file.content_type or "application/octet-stream",
    )
    gcs_url = f"gs://{up.bucket}/{up.path}"

    values = {
        "case_id":               case.id,
        "doc_gcs_bucket":        up.bucket,
        "doc_gcs_path":          up.path,
        "doc_gcs_url":           gcs_url,
        "doc_content_type":      up.content_type,
        "doc_size_bytes":        up.size_bytes,
        "doc_sha256":            up.sha256,
        "doc_original_filename": file.filename,
        "status":                "UPLOADED",
    }
    update_set = {k: v for k, v in values.items() if k != "case_id"}
    update_set["updated_at"] = func.now()

    stmt = pg_insert(PlVerification).values(**values).on_conflict_do_update(
        index_elements=["case_id"], set_=update_set,
    ).returning(PlVerification)
    row = (await db.execute(stmt)).scalar_one()

    return {
        "case_uuid":       str(case.id),
        "verification_id": str(row.id),
        "status":          "UPLOADED",
        "gcs_url":         gcs_url,
        "filename":        file.filename,
        "size_bytes":      up.size_bytes,
    }
