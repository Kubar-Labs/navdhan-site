-- Kuber Verification — initial schema
-- Apply to BOTH `kuber` (prod) and `kuber_dev` (dev) databases.
--
-- How to apply (via Cloud SQL Auth Proxy on localhost:5432):
--   psql -h 127.0.0.1 -U postgres -d kuber -f infra/sql/001_init.sql
--   psql -h 127.0.0.1 -U postgres -d kuber_dev -f infra/sql/001_init.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Enum types ────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE doc_type AS ENUM (
    'aadhaar_card', 'pan_card', 'bank_statement',
    'itr', 'form_26as', 'aadhaar_photo'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE verification_type AS ENUM (
    'aadhaar', 'pan', 'gstin', 'bank_statement', 'itr', 'form_26as'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE case_status AS ENUM (
    'pending', 'in_progress', 'verified', 'rejected', 'review'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Tables ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS borrowers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  pan             TEXT UNIQUE,
  aadhaar_hash    TEXT UNIQUE,            -- SHA-256 of Aadhaar; never store raw
  dob             DATE,
  mobile          TEXT,
  email           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         TEXT UNIQUE NOT NULL,   -- business-level ID from caller
  borrower_id     UUID REFERENCES borrowers(id),
  status          case_status NOT NULL DEFAULT 'pending',
  loan_amount     BIGINT,
  loan_type       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cases_borrower ON cases(borrower_id);

CREATE TABLE IF NOT EXISTS documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID REFERENCES cases(id) ON DELETE CASCADE,
  doc_type        doc_type NOT NULL,
  gcs_bucket      TEXT NOT NULL,
  gcs_path        TEXT NOT NULL,
  content_type    TEXT,
  size_bytes      BIGINT,
  sha256          CHAR(64),
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (case_id, doc_type)
);

CREATE TABLE IF NOT EXISTS verifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID REFERENCES cases(id) ON DELETE CASCADE,
  type            verification_type NOT NULL,
  perfios_txn_id  TEXT,
  status          TEXT,                   -- PROCESSING / COMPLETED / FAILED
  result_json     JSONB,
  error_code      TEXT,
  error_reason    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (case_id, type)                  -- idempotency key
);
CREATE INDEX IF NOT EXISTS idx_verifications_case ON verifications(case_id);
CREATE INDEX IF NOT EXISTS idx_verifications_txn ON verifications(perfios_txn_id);

-- ── Grants for kuber_app ──────────────────────────────────────────────────────
-- App user gets full DML, but no DDL. Migrations run as 'postgres'.
-- Note: CONNECT on the database is granted to PUBLIC by default in Postgres.
GRANT USAGE ON SCHEMA public TO kuber_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kuber_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO kuber_app;

-- Make future tables auto-granted too
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kuber_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO kuber_app;
