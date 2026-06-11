-- 023: Add user-uploaded-sheet + input-method tracking to ITR and 26AS.
--
-- Background: borrowers sometimes refuse to share IT portal credentials, or
-- don't have a portal account at all. New options on those steps:
--   1. Enter portal credentials (existing flow — Perfios fetches data)
--   2. Upload an ITR / 26AS sheet (we store it in GCS, lender reviews later)
--   3. Skip (explicit; we record the choice and surface a warning)
--
-- The existing pdf_gcs_* / excel_gcs_* columns hold Perfios-archived files
-- from the credentials flow. The new upload_* columns hold the user-uploaded
-- sheet (single file per case). input_method records which path was taken.
--
-- Apply via cloud-sql-proxy on 127.0.0.1:15432.

BEGIN;

ALTER TABLE itr_verifications
  ADD COLUMN IF NOT EXISTS input_method              TEXT,    -- 'credentials' | 'upload' | 'skipped'
  ADD COLUMN IF NOT EXISTS upload_gcs_bucket         TEXT,
  ADD COLUMN IF NOT EXISTS upload_gcs_path           TEXT,
  ADD COLUMN IF NOT EXISTS upload_gcs_url            TEXT,
  ADD COLUMN IF NOT EXISTS upload_content_type       TEXT,
  ADD COLUMN IF NOT EXISTS upload_size_bytes         BIGINT,
  ADD COLUMN IF NOT EXISTS upload_sha256             CHAR(64),
  ADD COLUMN IF NOT EXISTS upload_original_filename  TEXT;

ALTER TABLE form26as_verifications
  ADD COLUMN IF NOT EXISTS input_method              TEXT,
  ADD COLUMN IF NOT EXISTS upload_gcs_bucket         TEXT,
  ADD COLUMN IF NOT EXISTS upload_gcs_path           TEXT,
  ADD COLUMN IF NOT EXISTS upload_gcs_url            TEXT,
  ADD COLUMN IF NOT EXISTS upload_content_type       TEXT,
  ADD COLUMN IF NOT EXISTS upload_size_bytes         BIGINT,
  ADD COLUMN IF NOT EXISTS upload_sha256             CHAR(64),
  ADD COLUMN IF NOT EXISTS upload_original_filename  TEXT;

-- portal_password_ciphertext on itr_verifications and form26as_verifications
-- is already nullable — fine for the upload/skip paths that never store a
-- password.

COMMIT;
