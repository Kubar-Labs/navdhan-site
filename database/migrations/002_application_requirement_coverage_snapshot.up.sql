BEGIN;

ALTER TABLE application_requirements
    ADD COLUMN IF NOT EXISTS coverage_mode coverage_mode NOT NULL DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS min_count integer NOT NULL DEFAULT 1;

DO $constraint$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'application_requirements_min_count_check'
          AND conrelid = 'application_requirements'::regclass
    ) THEN
        ALTER TABLE application_requirements
            ADD CONSTRAINT application_requirements_min_count_check
            CHECK (min_count > 0);
    END IF;
END
$constraint$;

COMMIT;
