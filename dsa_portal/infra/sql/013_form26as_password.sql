-- DSA collect-only mode for Form 26AS:
-- We store the borrower's IT-portal password (encrypted) so the lender can
-- run Perfios's 26AS fetch later without re-prompting the user.

ALTER TABLE form26as_verifications
  ADD COLUMN IF NOT EXISTS it_portal_password_ciphertext TEXT;
