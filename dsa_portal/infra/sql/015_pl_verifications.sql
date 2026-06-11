-- Profit & Loss document collection.
-- Collect-only mode: store PDF/DOC in GCS, no analysis at upload time.

CREATE TABLE IF NOT EXISTS pl_verifications (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id               UUID NOT NULL UNIQUE
                          REFERENCES cases(id) ON DELETE CASCADE,

  -- Stored document
  doc_gcs_bucket        TEXT NOT NULL,
  doc_gcs_path          TEXT NOT NULL,
  doc_gcs_url           TEXT NOT NULL,          -- gs://{bucket}/{path} — for easy querying
  doc_content_type      TEXT,
  doc_size_bytes        BIGINT,
  doc_sha256            CHAR(64),
  doc_original_filename TEXT,

  status                TEXT NOT NULL DEFAULT 'UPLOADED',

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pl_status ON pl_verifications(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON pl_verifications TO kuber_app;
