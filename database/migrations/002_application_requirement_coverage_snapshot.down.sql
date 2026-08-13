BEGIN;

ALTER TABLE application_requirements
    DROP COLUMN IF EXISTS min_count,
    DROP COLUMN IF EXISTS coverage_mode;

COMMIT;
