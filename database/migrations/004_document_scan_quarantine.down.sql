-- Disposable local rollback only. PostgreSQL enum values cannot be safely
-- removed in-place, so 'quarantined' intentionally remains in document_status.

BEGIN;

DROP INDEX IF EXISTS documents_uploaded_for_requirement_idx;
DROP INDEX IF EXISTS documents_scan_job_uq;

ALTER TABLE documents
    DROP CONSTRAINT IF EXISTS document_scan_state_check,
    DROP CONSTRAINT IF EXISTS documents_uploaded_for_requirement_fk,
    DROP COLUMN IF EXISTS scan_completed_at,
    DROP COLUMN IF EXISTS scan_job_id,
    DROP COLUMN IF EXISTS uploaded_for_requirement_id;

COMMIT;
