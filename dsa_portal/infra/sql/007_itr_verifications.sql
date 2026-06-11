-- Per-type ITR Business API verification.
-- PAN encrypted+hashed (consistent with other tables).
-- IT-portal password is NEVER stored — pass-through to Perfios only.
-- Numeric financials kept as TEXT (Perfios sends Indian-comma strings + "Not Available").

CREATE TABLE IF NOT EXISTS itr_verifications (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                         UUID NOT NULL UNIQUE
                                    REFERENCES cases(id) ON DELETE CASCADE,

  -- Input
  pan_hash                        TEXT NOT NULL,
  pan_ciphertext                  TEXT NOT NULL,
  pan_last_4                      CHAR(4),
  api_version                     TEXT,
  number_of_years_requested       INTEGER,
  additional_data_requested       BOOLEAN,
  partial_report_requested        BOOLEAN,

  -- Entity (generalInformation)
  entity_name                     TEXT,
  entity_pan                      TEXT,
  entity_type                     TEXT,
  date_of_birth_or_incorporation  TEXT,
  entity_address                  TEXT,

  -- Filing history
  itr_filed                       JSONB,
  itr_filed_count                 INTEGER,
  latest_itr_year                 TEXT,
  latest_itr_form                 TEXT,
  latest_itr_status               TEXT,
  latest_filing_date              TEXT,

  -- Financial summaries
  financial_information           JSONB,
  number_of_years_returned        INTEGER,
  latest_assessment_year          TEXT,
  latest_financial_year           TEXT,
  latest_total_revenue            TEXT,
  latest_profit_after_tax         TEXT,
  latest_ebitda                   TEXT,
  latest_total_assets             TEXT,
  latest_total_equity             TEXT,
  latest_current_ratio            TEXT,
  latest_income_business_pct      TEXT,
  latest_income_salary_pct        TEXT,

  -- Other structured data
  members                         JSONB,
  bank_accounts                   JSONB,
  audit_information               JSONB,

  -- Form 26AS + AIS (additionalData=true)
  form_26as                       JSONB,
  ais_data                        JSONB,

  -- Download links (valid 14 days from Perfios)
  pdf_download_link               TEXT,
  excel_report_link               TEXT,

  -- Outcome
  status                          TEXT NOT NULL,
  perfios_status_code             TEXT,
  perfios_request_id              TEXT,
  error_code                      TEXT,
  error_reason                    TEXT,

  raw_response                    JSONB,

  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_itr_ver_pan_hash    ON itr_verifications(pan_hash);
CREATE INDEX IF NOT EXISTS idx_itr_ver_status      ON itr_verifications(status);
CREATE INDEX IF NOT EXISTS idx_itr_ver_entity_type ON itr_verifications(entity_type);

GRANT SELECT, INSERT, UPDATE, DELETE ON itr_verifications TO kuber_app;
