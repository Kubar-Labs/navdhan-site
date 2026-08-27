-- Fail closed for document malware scanning. Uploaded bytes remain quarantined
-- until a scanner verdict is bound to the exact GCS generation and SHA-256.

ALTER TYPE document_status ADD VALUE IF NOT EXISTS 'quarantined' AFTER 'uploading';

BEGIN;

ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS uploaded_for_requirement_id uuid,
    ADD COLUMN IF NOT EXISTS scan_job_id text,
    ADD COLUMN IF NOT EXISTS scan_completed_at timestamptz;

-- Preserve the borrower's intended requirement before unsafe legacy links are
-- detached. One uploaded document can later be linked to compatible sibling
-- requirements by application code after a clean result.
UPDATE documents AS document
SET uploaded_for_requirement_id = candidate.application_requirement_id
FROM (
    SELECT DISTINCT ON (satisfaction.document_id)
        satisfaction.document_id,
        satisfaction.application_requirement_id
    FROM document_requirement_satisfactions AS satisfaction
    WHERE satisfaction.unlinked_at IS NULL
    ORDER BY satisfaction.document_id, satisfaction.linked_at, satisfaction.satisfaction_id
) AS candidate
WHERE document.document_id = candidate.document_id
  AND document.uploaded_for_requirement_id IS NULL;

-- Historical branch-schema rows that never received a clean scan must never
-- remain usable. They require a borrower re-upload through the quarantine flow.
UPDATE documents
SET status = 'scan_failed',
    scan_result = 'unreadable',
    scan_job_id = 'migration-004-' || document_id::text,
    scan_completed_at = COALESCE(updated_at, created_at, now()),
    updated_at = now()
WHERE status IN ('uploading', 'uploaded', 'scan_failed')
  AND scan_result <> 'clean';

-- Retain auditable metadata for any clean rows produced before this migration.
UPDATE documents
SET scan_job_id = COALESCE(scan_job_id, 'migration-004-' || document_id::text),
    scan_completed_at = COALESCE(scan_completed_at, updated_at, created_at, now())
WHERE scan_result = 'clean';

-- An active row without an intended requirement is an orphan, not a usable
-- document. Mark it purged rather than guessing at a relationship.
UPDATE documents
SET status = 'purged',
    purged_at = COALESCE(purged_at, now()),
    updated_at = now()
WHERE status IN ('uploading', 'uploaded', 'quarantined', 'scan_failed')
  AND uploaded_for_requirement_id IS NULL;

WITH unlinked AS (
    UPDATE document_requirement_satisfactions AS satisfaction
    SET unlinked_at = now(),
        unlink_reason = 'scan_quarantine_migration'
    FROM documents AS document
    WHERE satisfaction.document_id = document.document_id
      AND satisfaction.marketplace_id = document.marketplace_id
      AND satisfaction.unlinked_at IS NULL
      AND (document.status <> 'uploaded' OR document.scan_result <> 'clean')
    RETURNING satisfaction.marketplace_id, satisfaction.application_requirement_id
)
UPDATE application_requirements AS requirement
SET status = 'pending',
    updated_at = now()
WHERE (requirement.marketplace_id, requirement.application_requirement_id) IN (
    SELECT marketplace_id, application_requirement_id FROM unlinked
)
  AND requirement.status NOT IN ('waived', 'not_applicable');

DO $constraints$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'documents_uploaded_for_requirement_fk'
          AND conrelid = 'documents'::regclass
    ) THEN
        ALTER TABLE documents
            ADD CONSTRAINT documents_uploaded_for_requirement_fk
            FOREIGN KEY (
                marketplace_id,
                application_id,
                uploaded_for_requirement_id
            ) REFERENCES application_requirements (
                marketplace_id,
                application_id,
                application_requirement_id
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'document_scan_state_check'
          AND conrelid = 'documents'::regclass
    ) THEN
        ALTER TABLE documents
            ADD CONSTRAINT document_scan_state_check CHECK (
                (
                    status IN ('uploading', 'quarantined')
                    AND scan_result = 'pending'
                    AND scan_job_id IS NULL
                    AND scan_completed_at IS NULL
                    AND uploaded_for_requirement_id IS NOT NULL
                )
                OR (
                    status = 'uploaded'
                    AND scan_result = 'clean'
                    AND scan_job_id IS NOT NULL
                    AND scan_completed_at IS NOT NULL
                    AND uploaded_for_requirement_id IS NOT NULL
                )
                OR (
                    status = 'scan_failed'
                    AND scan_result IN ('infected', 'unreadable')
                    AND scan_job_id IS NOT NULL
                    AND scan_completed_at IS NOT NULL
                    AND uploaded_for_requirement_id IS NOT NULL
                )
                OR status IN ('superseded', 'purged')
            );
    END IF;
END
$constraints$;

CREATE UNIQUE INDEX IF NOT EXISTS documents_scan_job_uq
    ON documents (marketplace_id, scan_job_id)
    WHERE scan_job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS documents_uploaded_for_requirement_idx
    ON documents (marketplace_id, application_id, uploaded_for_requirement_id)
    WHERE status NOT IN ('superseded', 'purged');

COMMIT;
