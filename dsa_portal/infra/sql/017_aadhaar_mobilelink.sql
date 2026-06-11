-- Switch Aadhaar verification from v2/aadhaar-verification (isIssued)
-- to v3/aadhaar-mobilelink (validId + isMobileLinked).
--
-- borrower_name is no longer collected at the Aadhaar step (UIDAI doesn't
-- expose it via the API); name now comes from PAN authority instead.

ALTER TABLE aadhaar_verifications
  ALTER COLUMN borrower_name DROP NOT NULL,

  -- Input captured from the form
  ADD COLUMN IF NOT EXISTS mobile_input        TEXT,

  -- v3/aadhaar-mobilelink response fields
  ADD COLUMN IF NOT EXISTS valid_id            TEXT,   -- "Yes" / "No"
  ADD COLUMN IF NOT EXISTS is_mobile_linked    TEXT,   -- "Yes" / "No"
  ADD COLUMN IF NOT EXISTS is_verified_mobile  TEXT;   -- "Yes" / "No"

CREATE INDEX IF NOT EXISTS idx_aadhaar_ver_valid_id
  ON aadhaar_verifications(valid_id);
