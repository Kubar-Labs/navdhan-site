-- Add encrypted IT portal password to itr_verifications.
-- Collect-only mode: credentials stored encrypted, Perfios call deferred.

ALTER TABLE itr_verifications
  ADD COLUMN IF NOT EXISTS portal_password_ciphertext TEXT;

COMMENT ON COLUMN itr_verifications.portal_password_ciphertext IS
  'AES-256-GCM encrypted IT portal password — decrypted by lender at analysis time';
