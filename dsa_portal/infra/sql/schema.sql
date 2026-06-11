-- Kuber Verification — clean schema (single source of truth)
-- Replaces all incremental migrations 001–016.
--
-- Apply:
--   psql -h 127.0.0.1 -U postgres -d kuber_dev -f infra/sql/schema.sql

-- ── Wipe ─────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS
  pl_verifications,
  bsa_verifications,
  form26as_verifications,
  itr_verifications,
  gst_verifications,
  pan_verifications,
  aadhaar_verifications,
  case_consents,
  verifications,
  documents,
  cases,
  borrowers
CASCADE;

DROP TYPE IF EXISTS doc_type, verification_type, case_status CASCADE;

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Enum types ────────────────────────────────────────────────────────────────
CREATE TYPE doc_type AS ENUM (
  'aadhaar_card', 'pan_card', 'bank_statement',
  'itr', 'form_26as', 'aadhaar_photo'
);

CREATE TYPE verification_type AS ENUM (
  'aadhaar', 'pan', 'gstin', 'bank_statement', 'itr', 'form_26as'
);

CREATE TYPE case_status AS ENUM (
  'pending', 'in_progress', 'verified', 'rejected', 'review'
);

-- ── borrowers ─────────────────────────────────────────────────────────────────
CREATE TABLE borrowers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  pan          TEXT UNIQUE,
  aadhaar_hash TEXT UNIQUE,
  dob          DATE,
  mobile       TEXT,
  email        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── cases ─────────────────────────────────────────────────────────────────────
CREATE TABLE cases (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id       TEXT UNIQUE NOT NULL,
  borrower_id   UUID REFERENCES borrowers(id),
  status        case_status NOT NULL DEFAULT 'pending',
  loan_amount   BIGINT,
  loan_type     TEXT,
  pan           TEXT,
  aadhaar_hash  TEXT,
  borrower_name TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cases_borrower     ON cases(borrower_id);
CREATE INDEX idx_cases_pan          ON cases(pan);
CREATE INDEX idx_cases_aadhaar_hash ON cases(aadhaar_hash);

-- ── case_consents ─────────────────────────────────────────────────────────────
CREATE TABLE case_consents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  consent_text    TEXT NOT NULL,
  consent_version TEXT,
  borrower_name   TEXT NOT NULL,
  ip_address      TEXT,
  user_agent      TEXT,
  accepted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_case_consents_case ON case_consents(case_id);

-- ── documents ─────────────────────────────────────────────────────────────────
CREATE TABLE documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id      UUID REFERENCES cases(id) ON DELETE CASCADE,
  doc_type     doc_type NOT NULL,
  gcs_bucket   TEXT NOT NULL,
  gcs_path     TEXT NOT NULL,
  content_type TEXT,
  size_bytes   BIGINT,
  sha256       CHAR(64),
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (case_id, doc_type)
);

-- ── verifications (generic) ───────────────────────────────────────────────────
CREATE TABLE verifications (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id            UUID REFERENCES cases(id) ON DELETE CASCADE,
  type               verification_type NOT NULL,
  perfios_txn_id     TEXT,
  status             TEXT,
  result_json        JSONB,
  error_code         TEXT,
  error_reason       TEXT,
  pan_aadhaar_linked BOOLEAN,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (case_id, type)
);

CREATE INDEX idx_verifications_case ON verifications(case_id);
CREATE INDEX idx_verifications_txn  ON verifications(perfios_txn_id);

-- ── aadhaar_verifications ─────────────────────────────────────────────────────
CREATE TABLE aadhaar_verifications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id             UUID NOT NULL UNIQUE REFERENCES cases(id) ON DELETE CASCADE,

  aadhaar_hash        TEXT NOT NULL,
  aadhaar_ciphertext  TEXT NOT NULL,
  aadhaar_last_4      CHAR(4),
  borrower_name       TEXT NOT NULL,

  is_issued           TEXT,
  gender              TEXT,
  state               TEXT,
  age_band            TEXT,
  mobile              TEXT,

  status              TEXT NOT NULL,
  perfios_status_code TEXT,
  perfios_request_id  TEXT,
  error_code          TEXT,
  error_reason        TEXT,

  photo_gcs_bucket    TEXT,
  photo_gcs_path      TEXT,
  photo_content_type  TEXT,
  photo_size_bytes    BIGINT,
  photo_sha256        CHAR(64),

  raw_response        JSONB,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_aadhaar_ver_hash   ON aadhaar_verifications(aadhaar_hash);
CREATE INDEX idx_aadhaar_ver_status ON aadhaar_verifications(status);
CREATE INDEX idx_aadhaar_ver_state  ON aadhaar_verifications(state);

-- ── pan_verifications ─────────────────────────────────────────────────────────
CREATE TABLE pan_verifications (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                     UUID NOT NULL UNIQUE REFERENCES cases(id) ON DELETE CASCADE,

  pan_hash                    TEXT NOT NULL,
  pan_ciphertext              TEXT NOT NULL,
  pan_last_4                  CHAR(4),
  borrower_name_input         TEXT,
  borrower_name               TEXT,

  status                      TEXT NOT NULL,
  perfios_status_code         TEXT,
  perfios_request_id          TEXT,
  error_code                  TEXT,
  error_reason                TEXT,

  pan_aadhaar_linked          BOOLEAN,
  pan_aadhaar_link_checked_at TIMESTAMPTZ,
  pan_aadhaar_link_response   JSONB,

  photo_gcs_bucket            TEXT,
  photo_gcs_path              TEXT,
  photo_content_type          TEXT,
  photo_size_bytes            BIGINT,
  photo_sha256                CHAR(64),

  raw_response                JSONB,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pan_ver_hash   ON pan_verifications(pan_hash);
CREATE INDEX idx_pan_ver_status ON pan_verifications(status);
CREATE INDEX idx_pan_ver_linked ON pan_verifications(pan_aadhaar_linked);

-- ── gst_verifications ─────────────────────────────────────────────────────────
CREATE TABLE gst_verifications (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                     UUID NOT NULL UNIQUE REFERENCES cases(id) ON DELETE CASCADE,

  gstin_hash                  TEXT NOT NULL,
  gstin_ciphertext            TEXT NOT NULL,
  gstin_last_4                CHAR(4),

  legal_name                  TEXT,
  trade_name                  TEXT,
  gst_status                  TEXT,
  constitution                TEXT,
  taxpayer_type               TEXT,
  registration_date           TEXT,
  cancellation_date           TEXT,
  cancel_flag                 TEXT,

  primary_address             TEXT,
  additional_addresses        JSONB,
  state_jurisdiction          TEXT,
  center_jurisdiction         TEXT,
  state_jurisdiction_code     TEXT,
  center_jurisdiction_code    TEXT,

  contact_name                TEXT,
  contact_email_ciphertext    TEXT,
  contact_mobile_ciphertext   TEXT,
  contact_mobile_last_4       CHAR(4),

  members                     JSONB,
  business_activities         JSONB,
  goods_business_details      JSONB,
  services_business_details   JSONB,
  core_business               TEXT,

  turnover_slab               TEXT,
  turnover_slab_fy            TEXT,
  gross_income                TEXT,
  gross_income_fy             TEXT,
  composition_rate            TEXT,
  percent_tax_in_cash         TEXT,
  percent_tax_in_cash_fy      TEXT,

  aadhaar_verified            TEXT,
  ekyc_verified               TEXT,
  einvoice_mandated           TEXT,
  einvoice_status             TEXT,
  compliance_detail_available BOOLEAN,

  is_defaulter                BOOLEAN,
  is_any_delay                BOOLEAN,
  gstr1_count                 INTEGER,
  gstr3b_count                INTEGER,
  gstr1a_count                INTEGER,
  delayed_filings_count       INTEGER,
  filings                     JSONB,
  filing_frequency            JSONB,

  status                      TEXT NOT NULL,
  perfios_status_code         TEXT,
  verify_perfios_request_id   TEXT,
  returns_perfios_request_id  TEXT,
  error_code                  TEXT,
  error_reason                TEXT,

  raw_verify_response         JSONB,
  raw_returns_response        JSONB,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gst_ver_hash         ON gst_verifications(gstin_hash);
CREATE INDEX idx_gst_ver_status       ON gst_verifications(status);
CREATE INDEX idx_gst_ver_is_defaulter ON gst_verifications(is_defaulter);
CREATE INDEX idx_gst_ver_is_any_delay ON gst_verifications(is_any_delay);
CREATE INDEX idx_gst_ver_gst_status   ON gst_verifications(gst_status);

-- ── itr_verifications ─────────────────────────────────────────────────────────
CREATE TABLE itr_verifications (
  id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                        UUID NOT NULL UNIQUE REFERENCES cases(id) ON DELETE CASCADE,

  pan_hash                       TEXT NOT NULL,
  pan_ciphertext                 TEXT NOT NULL,
  pan_last_4                     CHAR(4),
  portal_password_ciphertext     TEXT,          -- AES-256-GCM; decrypted by lender at analysis time
  api_version                    TEXT,
  number_of_years_requested      INTEGER,
  additional_data_requested      BOOLEAN,
  partial_report_requested       BOOLEAN,

  entity_name                    TEXT,
  entity_pan                     TEXT,
  entity_type                    TEXT,
  date_of_birth_or_incorporation TEXT,
  entity_address                 TEXT,

  pdf_download_link              TEXT,
  excel_report_link              TEXT,
  pdf_gcs_bucket                 TEXT,
  pdf_gcs_path                   TEXT,
  excel_gcs_bucket               TEXT,
  excel_gcs_path                 TEXT,

  status                         TEXT NOT NULL,
  perfios_status_code            TEXT,
  perfios_request_id             TEXT,
  error_code                     TEXT,
  error_reason                   TEXT,

  raw_response                   JSONB,

  created_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_itr_ver_pan_hash    ON itr_verifications(pan_hash);
CREATE INDEX idx_itr_ver_status      ON itr_verifications(status);
CREATE INDEX idx_itr_ver_entity_type ON itr_verifications(entity_type);

-- ── form26as_verifications ────────────────────────────────────────────────────
CREATE TABLE form26as_verifications (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                    UUID NOT NULL UNIQUE REFERENCES cases(id) ON DELETE CASCADE,

  pan_hash                   TEXT NOT NULL,
  pan_ciphertext             TEXT NOT NULL,
  pan_last_4                 CHAR(4),
  it_portal_password_ciphertext TEXT,           -- AES-256-GCM; for lender's deferred 26AS fetch
  source                     TEXT,
  api_version                TEXT,
  assessment_years_requested TEXT[],

  borrower_name              TEXT,
  borrower_pan               TEXT,
  borrower_status            TEXT,
  borrower_address           TEXT,

  status_of_26as_data        TEXT,

  pdf_download_link          TEXT,
  pdf_bucket_path            TEXT,
  excel_download_link        TEXT,
  excel_bucket_path          TEXT,
  pdf_gcs_bucket             TEXT,
  pdf_gcs_path               TEXT,
  excel_gcs_bucket           TEXT,
  excel_gcs_path             TEXT,

  status                     TEXT NOT NULL,
  perfios_status_code        TEXT,
  perfios_request_id         TEXT,
  error_code                 TEXT,
  error_reason               TEXT,

  raw_response               JSONB,

  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_f26as_pan_hash ON form26as_verifications(pan_hash);
CREATE INDEX idx_f26as_status   ON form26as_verifications(status);

-- ── bsa_verifications ─────────────────────────────────────────────────────────
CREATE TABLE bsa_verifications (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                     UUID NOT NULL UNIQUE REFERENCES cases(id) ON DELETE CASCADE,

  loan_amount                 BIGINT,
  loan_duration_months        INTEGER,
  loan_type                   TEXT,

  pdf_gcs_bucket              TEXT NOT NULL,
  pdf_gcs_path                TEXT NOT NULL,
  pdf_content_type            TEXT,
  pdf_size_bytes              BIGINT,
  pdf_sha256                  CHAR(64),
  pdf_original_filename       TEXT,
  pdf_password_ciphertext     TEXT,

  -- Perfios tamper-detection signals
  statement_status            TEXT,             -- VERIFIED = authentic e-statement
  is_suspicious_e_statement   BOOLEAN,          -- true = tampered / suspicious

  -- Perfios report files (permanent GCS copies)
  xlsx_gcs_bucket             TEXT,
  xlsx_gcs_path               TEXT,
  json_report_gcs_bucket      TEXT,
  json_report_gcs_path        TEXT,

  status                      TEXT NOT NULL DEFAULT 'UPLOADED',
  error_code                  TEXT,
  error_reason                TEXT,

  perfios_transaction_id      TEXT,
  perfios_request_id          TEXT,
  raw_response                JSONB,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bsa_status ON bsa_verifications(status);

-- ── pl_verifications ──────────────────────────────────────────────────────────
CREATE TABLE pl_verifications (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id               UUID NOT NULL UNIQUE REFERENCES cases(id) ON DELETE CASCADE,

  doc_gcs_bucket        TEXT NOT NULL,
  doc_gcs_path          TEXT NOT NULL,
  doc_gcs_url           TEXT NOT NULL,          -- gs://{bucket}/{path}
  doc_content_type      TEXT,
  doc_size_bytes        BIGINT,
  doc_sha256            CHAR(64),
  doc_original_filename TEXT,

  status                TEXT NOT NULL DEFAULT 'UPLOADED',

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pl_status ON pl_verifications(status);

-- ── Grants ────────────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO kuber_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kuber_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO kuber_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kuber_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO kuber_app;
