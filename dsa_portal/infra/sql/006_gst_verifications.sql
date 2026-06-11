-- Per-type GST verification table.
-- Holds output from BOTH Perfios calls:
--   /v2/gstdetailed-additional  (business profile)
--   /v2/gst-return-status       (filing history)
-- Same case_id key — calls upsert into one row, never overwrite each other's fields.

CREATE TABLE IF NOT EXISTS gst_verifications (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                       UUID NOT NULL UNIQUE
                                  REFERENCES cases(id) ON DELETE CASCADE,

  -- Input (encrypted + hashed)
  gstin_hash                    TEXT NOT NULL,
  gstin_ciphertext              TEXT NOT NULL,
  gstin_last_4                  CHAR(4),

  -- Business identity
  legal_name                    TEXT,
  trade_name                    TEXT,
  gst_status                    TEXT,
  constitution                  TEXT,
  taxpayer_type                 TEXT,
  registration_date             TEXT,
  cancellation_date             TEXT,
  cancel_flag                   TEXT,

  -- Address & jurisdiction
  primary_address               TEXT,
  additional_addresses          JSONB,
  state_jurisdiction            TEXT,
  center_jurisdiction           TEXT,
  state_jurisdiction_code       TEXT,
  center_jurisdiction_code      TEXT,

  -- Contact (PII)
  contact_name                  TEXT,
  contact_email_ciphertext      TEXT,
  contact_mobile_ciphertext     TEXT,
  contact_mobile_last_4         CHAR(4),

  -- Members & business activity
  members                       JSONB,
  business_activities           JSONB,
  goods_business_details        JSONB,
  services_business_details     JSONB,
  core_business                 TEXT,

  -- Financial signals
  turnover_slab                 TEXT,
  turnover_slab_fy              TEXT,
  gross_income                  TEXT,
  gross_income_fy               TEXT,
  composition_rate              TEXT,
  percent_tax_in_cash           TEXT,
  percent_tax_in_cash_fy        TEXT,

  -- Compliance flags (API 1)
  aadhaar_verified              TEXT,
  ekyc_verified                 TEXT,
  einvoice_mandated             TEXT,
  einvoice_status               TEXT,
  compliance_detail_available   BOOLEAN,

  -- Compliance & filings (API 2)
  is_defaulter                  BOOLEAN,
  is_any_delay                  BOOLEAN,
  gstr1_count                   INTEGER,
  gstr3b_count                  INTEGER,
  gstr1a_count                  INTEGER,
  delayed_filings_count         INTEGER,
  filings                       JSONB,
  filing_frequency              JSONB,

  -- Outcome
  status                        TEXT NOT NULL,
  perfios_status_code           TEXT,
  verify_perfios_request_id     TEXT,
  returns_perfios_request_id    TEXT,
  error_code                    TEXT,
  error_reason                  TEXT,

  -- Audit
  raw_verify_response           JSONB,
  raw_returns_response          JSONB,

  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gst_ver_hash         ON gst_verifications(gstin_hash);
CREATE INDEX IF NOT EXISTS idx_gst_ver_status       ON gst_verifications(status);
CREATE INDEX IF NOT EXISTS idx_gst_ver_is_defaulter ON gst_verifications(is_defaulter);
CREATE INDEX IF NOT EXISTS idx_gst_ver_is_any_delay ON gst_verifications(is_any_delay);
CREATE INDEX IF NOT EXISTS idx_gst_ver_gst_status   ON gst_verifications(gst_status);

GRANT SELECT, INSERT, UPDATE, DELETE ON gst_verifications TO kuber_app;
