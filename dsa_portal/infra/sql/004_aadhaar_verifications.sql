-- Per-type verification table for Aadhaar eKYC.
-- Photo is inlined (no documents table reference).
-- Aadhaar number is stored BOTH as:
--   - SHA-256 hash (fast, indexed, for de-dup)
--   - AES-256-GCM ciphertext (reversible, key in Secret Manager)
--   - last 4 digits (for masked display without decrypting)

CREATE TABLE IF NOT EXISTS aadhaar_verifications (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id              UUID NOT NULL UNIQUE
                         REFERENCES cases(id) ON DELETE CASCADE,

  -- Input
  aadhaar_hash         TEXT NOT NULL,       -- SHA-256 of 12-digit number
  aadhaar_ciphertext   TEXT NOT NULL,       -- AES-256-GCM, base64
  aadhaar_last_4       CHAR(4),             -- for masked UI
  borrower_name        TEXT NOT NULL,

  -- Perfios output (flattened)
  is_issued            TEXT,                -- "Y" / "N"
  gender               TEXT,
  state                TEXT,
  age_band             TEXT,
  mobile               TEXT,

  -- Outcome
  status               TEXT NOT NULL,        -- COMPLETED / FAILED
  perfios_status_code  TEXT,
  perfios_request_id   TEXT,
  error_code           TEXT,
  error_reason         TEXT,

  -- Aadhaar card photo (inline)
  photo_gcs_bucket     TEXT,
  photo_gcs_path       TEXT,
  photo_content_type   TEXT,
  photo_size_bytes     BIGINT,
  photo_sha256         CHAR(64),

  raw_response         JSONB,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aadhaar_ver_hash   ON aadhaar_verifications(aadhaar_hash);
CREATE INDEX IF NOT EXISTS idx_aadhaar_ver_status ON aadhaar_verifications(status);
CREATE INDEX IF NOT EXISTS idx_aadhaar_ver_state  ON aadhaar_verifications(state);

-- Grants for app user (DML only, no DDL)
GRANT SELECT, INSERT, UPDATE, DELETE ON aadhaar_verifications TO kuber_app;
