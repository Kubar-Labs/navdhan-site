-- Lean itr_verifications. Same DSA-style trim as 26AS.

ALTER TABLE itr_verifications
  DROP COLUMN IF EXISTS itr_filed,
  DROP COLUMN IF EXISTS itr_filed_count,
  DROP COLUMN IF EXISTS latest_itr_year,
  DROP COLUMN IF EXISTS latest_itr_form,
  DROP COLUMN IF EXISTS latest_itr_status,
  DROP COLUMN IF EXISTS latest_filing_date,
  DROP COLUMN IF EXISTS financial_information,
  DROP COLUMN IF EXISTS number_of_years_returned,
  DROP COLUMN IF EXISTS latest_assessment_year,
  DROP COLUMN IF EXISTS latest_financial_year,
  DROP COLUMN IF EXISTS latest_total_revenue,
  DROP COLUMN IF EXISTS latest_profit_after_tax,
  DROP COLUMN IF EXISTS latest_ebitda,
  DROP COLUMN IF EXISTS latest_total_assets,
  DROP COLUMN IF EXISTS latest_total_equity,
  DROP COLUMN IF EXISTS latest_current_ratio,
  DROP COLUMN IF EXISTS latest_income_business_pct,
  DROP COLUMN IF EXISTS latest_income_salary_pct,
  DROP COLUMN IF EXISTS members,
  DROP COLUMN IF EXISTS bank_accounts,
  DROP COLUMN IF EXISTS audit_information,
  DROP COLUMN IF EXISTS form_26as,
  DROP COLUMN IF EXISTS ais_data;

-- GCS paths for permanent archival of Perfios files
ALTER TABLE itr_verifications
  ADD COLUMN IF NOT EXISTS pdf_gcs_bucket   TEXT,
  ADD COLUMN IF NOT EXISTS pdf_gcs_path     TEXT,
  ADD COLUMN IF NOT EXISTS excel_gcs_bucket TEXT,
  ADD COLUMN IF NOT EXISTS excel_gcs_path   TEXT;
