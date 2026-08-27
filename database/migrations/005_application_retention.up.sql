BEGIN;

ALTER TABLE loan_applications
    ADD COLUMN IF NOT EXISTS retention_purged_at timestamptz;

CREATE INDEX IF NOT EXISTS loan_applications_retention_candidates_idx
    ON loan_applications (marketplace_id, submitted_at, updated_at)
    WHERE retention_purged_at IS NULL;

COMMIT;
