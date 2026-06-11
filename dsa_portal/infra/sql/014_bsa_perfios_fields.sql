-- Wire Perfios BSA analysis into the upload flow.
-- Adds tamper-detection signals and report GCS references.

ALTER TABLE bsa_verifications
  ADD COLUMN IF NOT EXISTS statement_status              TEXT,
  ADD COLUMN IF NOT EXISTS is_suspicious_e_statement     BOOLEAN,
  ADD COLUMN IF NOT EXISTS xlsx_gcs_bucket               TEXT,
  ADD COLUMN IF NOT EXISTS xlsx_gcs_path                 TEXT,
  ADD COLUMN IF NOT EXISTS json_report_gcs_bucket        TEXT,
  ADD COLUMN IF NOT EXISTS json_report_gcs_path          TEXT;

COMMENT ON COLUMN bsa_verifications.statement_status IS
  'Perfios statementdetails[].statementStatus — VERIFIED means authentic e-statement';
COMMENT ON COLUMN bsa_verifications.is_suspicious_e_statement IS
  'Perfios fCUAnalysis.possibleFraudIndicators.suspiciousBankEStatements.status — true = tampered/suspicious';
