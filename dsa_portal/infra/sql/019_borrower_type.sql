-- 019: Add borrower_type + entity_legal_name to cases.
--
-- Background: lending journey now branches at consent between INDIVIDUAL and
-- BUSINESS borrowers. Business borrowers have no Aadhaar (company / firm /
-- LLP), the PAN format differs (4th char != 'P'), and we need to record the
-- entity's legal name separately from the natural-person signatory name
-- captured in `case_consents.borrower_name`.
--
-- Apply to BOTH `kuber` (prod) and `kuber_dev` (dev) via cloud-sql-proxy:
--   psql -h 127.0.0.1 -U postgres -d kuber     -f infra/sql/019_borrower_type.sql
--   psql -h 127.0.0.1 -U postgres -d kuber_dev -f infra/sql/019_borrower_type.sql

BEGIN;

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS borrower_type      TEXT NOT NULL DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS entity_legal_name  TEXT;

-- Constrain borrower_type to the two values the application supports.
ALTER TABLE cases
  DROP CONSTRAINT IF EXISTS cases_borrower_type_check;
ALTER TABLE cases
  ADD  CONSTRAINT cases_borrower_type_check
       CHECK (borrower_type IN ('individual', 'business'));

COMMIT;
