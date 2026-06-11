-- Per-case consent record. Captured ONCE at journey start; covers all
-- subsequent verifications. Consent text is stored verbatim (audit-ready)
-- alongside the borrower's typed name (digital signature), IP, and UA.

CREATE TABLE IF NOT EXISTS case_consents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,

  consent_text    TEXT NOT NULL,
  consent_version TEXT,                  -- e.g. "v1.0"

  borrower_name   TEXT NOT NULL,         -- typed as digital signature
  ip_address      TEXT,
  user_agent      TEXT,

  accepted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_consents_case ON case_consents(case_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON case_consents TO kuber_app;
