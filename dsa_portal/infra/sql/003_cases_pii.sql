-- Staging-model refactor: case_id is the journey identity.
-- Put PII on `cases` directly during the verification journey.
-- `borrowers` is now populated only by a post-journey de-dup process
-- (not touched by any route during verification).

ALTER TABLE cases ADD COLUMN IF NOT EXISTS pan            TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS aadhaar_hash   TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS borrower_name  TEXT;

-- No UNIQUE constraint on these: the same person may have many cases over time.
-- Lookups within a journey go through case_id only.

CREATE INDEX IF NOT EXISTS idx_cases_pan          ON cases(pan);
CREATE INDEX IF NOT EXISTS idx_cases_aadhaar_hash ON cases(aadhaar_hash);

-- Track whether PAN is linked to Aadhaar for a case.
-- This is computed from Perfios's /v3/pan-aadhaar-link response; we store
-- the boolean on the pan verification row (via result_json) but also
-- surface it as a convenience flag for SQL queries.
ALTER TABLE verifications ADD COLUMN IF NOT EXISTS pan_aadhaar_linked BOOLEAN;
