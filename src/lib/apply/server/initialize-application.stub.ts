// Auto-generated compile-safe stub - architect apply-contract v1.0.0
// GREEN-phase implementation: bootstrap an encrypted wizard state.

import { randomBytes } from "crypto";
import { storeIdempotencyKey } from "./idempotency.stub";

const STATE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function generateReference(): string {
  const entropy = randomBytes(10)
    .toString("base64url")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 16);
  return `ndh-apply-${entropy}`;
}

export async function initializeApplication(input: {
  idempotencyKey: string;
}): Promise<{ application_reference: string; expires_at: string }> {
  const application_reference = generateReference();
  await storeIdempotencyKey({
    key: input.idempotencyKey,
    reference: application_reference,
  });
  return {
    application_reference,
    expires_at: new Date(Date.now() + STATE_TTL_MS).toISOString(),
  };
}
