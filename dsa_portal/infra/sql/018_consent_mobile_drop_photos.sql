-- 018: Add mobile to case_consents; drop photo capture from Aadhaar + PAN.
--
-- Apply to BOTH `kuber` (prod) and `kuber_dev` (dev) via cloud-sql-proxy:
--   psql -h 127.0.0.1 -U postgres -d kuber     -f infra/sql/018_consent_mobile_drop_photos.sql
--   psql -h 127.0.0.1 -U postgres -d kuber_dev -f infra/sql/018_consent_mobile_drop_photos.sql

BEGIN;

-- 1) Capture borrower mobile at consent time. NULL allowed for legacy rows;
-- the application enforces presence on new submissions.
ALTER TABLE case_consents
  ADD COLUMN IF NOT EXISTS mobile TEXT;

-- 2) Drop photo upload columns from Aadhaar and PAN verification tables.
-- App no longer collects images for these flows.
ALTER TABLE aadhaar_verifications
  DROP COLUMN IF EXISTS photo_gcs_bucket,
  DROP COLUMN IF EXISTS photo_gcs_path,
  DROP COLUMN IF EXISTS photo_content_type,
  DROP COLUMN IF EXISTS photo_size_bytes,
  DROP COLUMN IF EXISTS photo_sha256;

ALTER TABLE pan_verifications
  DROP COLUMN IF EXISTS photo_gcs_bucket,
  DROP COLUMN IF EXISTS photo_gcs_path,
  DROP COLUMN IF EXISTS photo_content_type,
  DROP COLUMN IF EXISTS photo_size_bytes,
  DROP COLUMN IF EXISTS photo_sha256;

-- Note on the doc_type enum: 'aadhaar_photo' and 'aadhaar_card' / 'pan_card'
-- enum values are intentionally left in place. Postgres can't drop enum values
-- without recreating the type, and they're harmless when unused. The
-- `documents` table no longer receives writes for these doc_types.

COMMIT;
