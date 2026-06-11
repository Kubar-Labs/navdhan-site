-- Lean form26as_verifications.
-- DSA flow: we collect, lender consumes. We don't analyze line items —
-- the Excel file is sufficient for the lender. Drop all aggregate columns
-- and per-AY blob; keep profile, links, GCS paths, raw_response (audit).

ALTER TABLE form26as_verifications
  DROP COLUMN IF EXISTS per_year_data,
  DROP COLUMN IF EXISTS assessment_years_returned,
  DROP COLUMN IF EXISTS total_amount_credited,
  DROP COLUMN IF EXISTS total_tds_deducted,
  DROP COLUMN IF EXISTS total_tcs_collected,
  DROP COLUMN IF EXISTS total_refunds_received,
  DROP COLUMN IF EXISTS unique_deductor_count,
  DROP COLUMN IF EXISTS unique_collector_count,
  DROP COLUMN IF EXISTS has_tds_defaults,
  DROP COLUMN IF EXISTS latest_assessment_year,
  DROP COLUMN IF EXISTS latest_amount_credited,
  DROP COLUMN IF EXISTS latest_tds_deducted,
  DROP COLUMN IF EXISTS latest_tcs_collected,
  DROP COLUMN IF EXISTS top_deductor_name,
  DROP COLUMN IF EXISTS top_deductor_tan,
  DROP COLUMN IF EXISTS top_deductor_amount;

-- Indexes that referenced dropped columns
DROP INDEX IF EXISTS idx_f26as_has_defaults;
DROP INDEX IF EXISTS idx_f26as_total_credited;

-- Add permanent GCS paths (so we don't depend on Perfios's 14-day links)
ALTER TABLE form26as_verifications
  ADD COLUMN IF NOT EXISTS pdf_gcs_bucket   TEXT,
  ADD COLUMN IF NOT EXISTS pdf_gcs_path     TEXT,
  ADD COLUMN IF NOT EXISTS excel_gcs_bucket TEXT,
  ADD COLUMN IF NOT EXISTS excel_gcs_path   TEXT;
