-- 021: Split KYB storage into one table per business verification type.
--
-- Replaces the consolidated `kyb_verifications` (from migration 020) with
-- four dedicated tables — mirrors how the individual flow is laid out
-- (one table per verification: pan_verifications, gst_verifications, etc.).
--
--   kyb_pan_verifications  — /kyb/pan/verify       (Perfios /v2/pan, business)
--   kyb_cin_verifications  — /kyb/pan/cin-llpin    (Perfios /v3/pan-cin)
--   kyb_gst_searches       — /kyb/pan/gst-by-pan   (Perfios /v2/search)
--   kyb_pl_verifications   — /kyb/pl/mca-fetch     (Perfios /v1/corp/docs/request-details, async webhook)
--
-- The old kyb_verifications is dropped. It was created by 020 but is empty
-- in prod (migration 020 was applied before any business borrower hit the
-- new flow), so there's no data to migrate.
--
-- Apply via cloud-sql-proxy on 127.0.0.1:15432:
--   python backend/_apply_NNN.py

BEGIN;

DROP TABLE IF EXISTS kyb_verifications;

-- ── kyb_pan_verifications ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kyb_pan_verifications (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                UUID NOT NULL UNIQUE
                           REFERENCES cases(id) ON DELETE CASCADE,

  pan_hash               TEXT NOT NULL,
  pan_ciphertext         TEXT NOT NULL,
  pan_last_4             CHAR(4),

  entity_name            TEXT,                -- name as returned by Perfios PAN auth
  status                 TEXT NOT NULL,       -- 'verified' | 'failed' | 'error'
  perfios_request_id     TEXT,
  perfios_status_code    TEXT,
  error_code             TEXT,
  error_reason           TEXT,
  raw_response           JSONB,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS kyb_pan_verifications_pan_hash_idx
  ON kyb_pan_verifications(pan_hash);

-- ── kyb_cin_verifications ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kyb_cin_verifications (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                UUID NOT NULL UNIQUE
                           REFERENCES cases(id) ON DELETE CASCADE,

  pan_hash               TEXT NOT NULL,
  pan_ciphertext         TEXT NOT NULL,
  pan_last_4             CHAR(4),

  cin_llpin              TEXT,
  entity_name            TEXT,                -- name as returned by /v3/pan-cin
  status                 TEXT NOT NULL,       -- 'found' | 'not_found' | 'error'
  perfios_request_id     TEXT,
  perfios_status_code    TEXT,
  error_code             TEXT,
  error_reason           TEXT,
  raw_response           JSONB,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS kyb_cin_verifications_pan_hash_idx
  ON kyb_cin_verifications(pan_hash);
CREATE INDEX IF NOT EXISTS kyb_cin_verifications_cin_llpin_idx
  ON kyb_cin_verifications(cin_llpin);

-- ── kyb_gst_searches ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kyb_gst_searches (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                UUID NOT NULL UNIQUE
                           REFERENCES cases(id) ON DELETE CASCADE,

  pan_hash               TEXT NOT NULL,
  pan_ciphertext         TEXT NOT NULL,
  pan_last_4             CHAR(4),

  gstins                 JSONB,               -- full array of search hits
  gstin_ids              TEXT[],              -- just the IDs for fast filtering
  gstin_count            INTEGER,
  status                 TEXT NOT NULL,       -- 'found' | 'not_found' | 'error'
  perfios_request_id     TEXT,
  perfios_status_code    TEXT,
  error_code             TEXT,
  error_reason           TEXT,
  raw_response           JSONB,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS kyb_gst_searches_pan_hash_idx
  ON kyb_gst_searches(pan_hash);

-- ── kyb_pl_verifications ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kyb_pl_verifications (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                  UUID NOT NULL UNIQUE
                             REFERENCES cases(id) ON DELETE CASCADE,

  pan_hash                 TEXT NOT NULL,
  pan_ciphertext           TEXT NOT NULL,
  pan_last_4               CHAR(4),

  -- async fetch state
  mca_request_id           TEXT,
  mca_entity_id            TEXT,              -- CIN/LLPIN we asked MCA about
  status                   TEXT NOT NULL,     -- 'pending' | 'completed' | 'failed'
  perfios_request_id       TEXT,
  perfios_status_code      TEXT,
  error_code               TEXT,
  error_reason             TEXT,
  triggered_at             TIMESTAMPTZ,
  completed_at             TIMESTAMPTZ,

  -- denormalized P&L numbers (latest FY only; full data in raw_response)
  pl_financial_year_end    TEXT,
  pl_revenue_from_operations BIGINT,
  pl_total_revenue         BIGINT,
  pl_total_expenses        BIGINT,
  pl_profit_before_tax     BIGINT,
  pl_profit_loss           BIGINT,
  pl_pdf_download_link     TEXT,
  pl_excel_download_link   TEXT,

  raw_response             JSONB,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS kyb_pl_verifications_pan_hash_idx
  ON kyb_pl_verifications(pan_hash);
CREATE INDEX IF NOT EXISTS kyb_pl_verifications_mca_request_id_idx
  ON kyb_pl_verifications(mca_request_id);

COMMIT;
