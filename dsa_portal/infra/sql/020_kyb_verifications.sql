-- 020: KYB (Know-Your-Business) verifications table.
--
-- For business borrowers we run two extra Perfios calls after PAN auth:
--   1. POST /ssp/kscan/api/v3/pan-cin  → CIN/LLPIN + registered entity name
--   2. POST /ssp/gst/api/v2/search     → all GSTINs registered against the PAN
--
-- Kept in a separate table from `pan_verifications` so the individual KYC
-- flow stays untouched and so analysts can query KYB signals in isolation.
--
-- Apply to BOTH `kuber` (prod) and `kuber_dev` (dev) via cloud-sql-proxy:
--   psql -h 127.0.0.1 -U postgres -d kuber     -f infra/sql/020_kyb_verifications.sql
--   psql -h 127.0.0.1 -U postgres -d kuber_dev -f infra/sql/020_kyb_verifications.sql

BEGIN;

CREATE TABLE IF NOT EXISTS kyb_verifications (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                         UUID NOT NULL UNIQUE
                                    REFERENCES cases(id) ON DELETE CASCADE,

  -- PAN (encrypted + hashed; mirrors pan_verifications conventions)
  pan_hash                        TEXT NOT NULL,
  pan_ciphertext                  TEXT NOT NULL,
  pan_last_4                      CHAR(4),

  -- /pan-cin (KSCAN) — only the first result is denormalized; full array in raw_cin_response
  cin_llpin                       TEXT,
  entity_name_from_cin            TEXT,
  cin_status                      TEXT,    -- 'found' | 'not_found' | 'error'
  cin_perfios_request_id          TEXT,
  cin_perfios_status_code         TEXT,
  cin_error_code                  TEXT,
  cin_error_reason                TEXT,
  raw_cin_response                JSONB,

  -- /gst/v2/search (GST-by-PAN) — denormalized GSTIN list + count for queryability
  gstins                          JSONB,   -- full array of {gstinId, state, authStatus, ...}
  gstin_ids                       TEXT[],  -- just the IDs for fast filtering
  gstin_count                     INTEGER,
  gst_search_status               TEXT,    -- 'found' | 'not_found' | 'error'
  gst_search_perfios_request_id   TEXT,
  gst_search_perfios_status_code  TEXT,
  gst_search_error_code           TEXT,
  gst_search_error_reason         TEXT,
  raw_gst_search_response         JSONB,

  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS kyb_verifications_case_id_idx ON kyb_verifications(case_id);
CREATE INDEX IF NOT EXISTS kyb_verifications_pan_hash_idx ON kyb_verifications(pan_hash);

COMMIT;
