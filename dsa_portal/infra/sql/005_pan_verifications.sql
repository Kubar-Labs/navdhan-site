-- Per-type PAN verification table. PAN is stored encrypted (AES-256-GCM)
-- for DPDP compliance, and hashed for de-dup lookups.
-- Photo is inlined. The /pan/link step updates this same row.

CREATE TABLE IF NOT EXISTS pan_verifications (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                      UUID NOT NULL UNIQUE
                                 REFERENCES cases(id) ON DELETE CASCADE,

  -- Input
  pan_hash                     TEXT NOT NULL,
  pan_ciphertext               TEXT NOT NULL,
  pan_last_4                   CHAR(4),
  borrower_name_input          TEXT,

  -- Perfios /v2/pan output
  borrower_name                TEXT,

  -- Outcome
  status                       TEXT NOT NULL,
  perfios_status_code          TEXT,
  perfios_request_id           TEXT,
  error_code                   TEXT,
  error_reason                 TEXT,

  -- PAN-Aadhaar link (filled by /pan/link when run for this case)
  pan_aadhaar_linked           BOOLEAN,
  pan_aadhaar_link_checked_at  TIMESTAMPTZ,
  pan_aadhaar_link_response    JSONB,

  -- PAN card photo (inline)
  photo_gcs_bucket             TEXT,
  photo_gcs_path               TEXT,
  photo_content_type           TEXT,
  photo_size_bytes             BIGINT,
  photo_sha256                 CHAR(64),

  raw_response                 JSONB,

  created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pan_ver_hash   ON pan_verifications(pan_hash);
CREATE INDEX IF NOT EXISTS idx_pan_ver_status ON pan_verifications(status);
CREATE INDEX IF NOT EXISTS idx_pan_ver_linked ON pan_verifications(pan_aadhaar_linked);

GRANT SELECT, INSERT, UPDATE, DELETE ON pan_verifications TO kuber_app;
