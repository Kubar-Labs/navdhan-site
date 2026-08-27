BEGIN;

DROP INDEX IF EXISTS loan_applications_retention_candidates_idx;

ALTER TABLE loan_applications
    DROP COLUMN IF EXISTS retention_purged_at;

COMMIT;
