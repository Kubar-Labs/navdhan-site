-- Per-type Form 26AS verification.
-- PAN encrypted+hashed. IT-portal password NEVER stored.
-- Per-AY nested data preserved in JSONB; aggregates denormalized for queries.

CREATE TABLE IF NOT EXISTS form26as_verifications (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                     UUID NOT NULL UNIQUE
                                REFERENCES cases(id) ON DELETE CASCADE,

  -- Input
  pan_hash                    TEXT NOT NULL,
  pan_ciphertext              TEXT NOT NULL,
  pan_last_4                  CHAR(4),
  source                      TEXT,            -- "ITR" or "TRACES"
  api_version                 TEXT,
  assessment_years_requested  TEXT[],

  -- Profile (result.profile)
  borrower_name               TEXT,
  borrower_pan                TEXT,
  borrower_status             TEXT,
  borrower_address            TEXT,

  -- Per-AY data
  per_year_data               JSONB,
  assessment_years_returned   TEXT[],
  status_of_26as_data         TEXT,

  -- Aggregates across AYs
  total_amount_credited       NUMERIC(20, 2),
  total_tds_deducted          NUMERIC(20, 2),
  total_tcs_collected         NUMERIC(20, 2),
  total_refunds_received      NUMERIC(20, 2),
  unique_deductor_count       INTEGER,
  unique_collector_count      INTEGER,
  has_tds_defaults            BOOLEAN,

  -- Latest AY breakout
  latest_assessment_year      TEXT,
  latest_amount_credited      NUMERIC(20, 2),
  latest_tds_deducted         NUMERIC(20, 2),
  latest_tcs_collected        NUMERIC(20, 2),

  -- Top deductor
  top_deductor_name           TEXT,
  top_deductor_tan            TEXT,
  top_deductor_amount         NUMERIC(20, 2),

  -- Downloads (valid 14 days)
  pdf_download_link           TEXT,
  pdf_bucket_path             TEXT,
  excel_download_link         TEXT,
  excel_bucket_path           TEXT,

  -- Outcome
  status                      TEXT NOT NULL,
  perfios_status_code         TEXT,
  perfios_request_id          TEXT,
  error_code                  TEXT,
  error_reason                TEXT,

  raw_response                JSONB,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_f26as_pan_hash       ON form26as_verifications(pan_hash);
CREATE INDEX IF NOT EXISTS idx_f26as_status         ON form26as_verifications(status);
CREATE INDEX IF NOT EXISTS idx_f26as_has_defaults   ON form26as_verifications(has_tds_defaults);
CREATE INDEX IF NOT EXISTS idx_f26as_total_credited ON form26as_verifications(total_amount_credited);

GRANT SELECT, INSERT, UPDATE, DELETE ON form26as_verifications TO kuber_app;
