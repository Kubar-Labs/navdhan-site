BEGIN;

ALTER TABLE persons
    ADD COLUMN IF NOT EXISTS email_hash bytea;

COMMIT;

CREATE INDEX CONCURRENTLY IF NOT EXISTS persons_email_hash_idx
    ON persons (marketplace_id, email_hash)
    WHERE email_hash IS NOT NULL;
