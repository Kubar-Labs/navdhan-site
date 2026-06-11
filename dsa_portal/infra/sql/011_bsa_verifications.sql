-- Lean bank statement collection.
-- DSA mode: we collect the PDF + password, store both, lender does analysis.
-- No Perfios calls at this stage.

CREATE TABLE IF NOT EXISTS bsa_verifications (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                  UUID NOT NULL UNIQUE
                             REFERENCES cases(id) ON DELETE CASCADE,

  -- Loan context (lender consumes)
  loan_amount              BIGINT,
  loan_duration_months     INTEGER,
  loan_type                TEXT,

  -- Bank statement PDF (in our GCS bucket, permanent)
  pdf_gcs_bucket           TEXT NOT NULL,
  pdf_gcs_path             TEXT NOT NULL,
  pdf_content_type         TEXT,
  pdf_size_bytes           BIGINT,
  pdf_sha256               CHAR(64),
  pdf_original_filename    TEXT,

  -- PDF password (AES-256-GCM encrypted) — NULL if PDF was not protected
  pdf_password_ciphertext  TEXT,

  -- Status (UPLOADED at this stage; PROCESSED later when Perfios runs)
  status                   TEXT NOT NULL DEFAULT 'UPLOADED',
  error_code               TEXT,
  error_reason             TEXT,

  -- Reserved for when we wire Perfios back in
  perfios_transaction_id   TEXT,
  perfios_request_id       TEXT,
  raw_response             JSONB,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bsa_status ON bsa_verifications(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON bsa_verifications TO kuber_app;
