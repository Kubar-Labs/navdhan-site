/**
 * Repository for encrypted premium apply wizard state.
 *
 * All writes are wrapped in explicit transactions and updates lock the target
 * row with SELECT ... FOR UPDATE before mutating state, satisfying Kubar
 * fintech row-level locking rules.
 */

import { eq, gt, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { applicationState } from "@/src/db/schema";
import { decryptState, encryptState } from "./state-crypto";

export interface WizardState {
  reference: string;
  locale: string;
  loanAmount: number;
  [key: string]: unknown;
}

/**
 * Create a new encrypted application_state row.
 *
 * @param reference - Short opaque reference exposed to the frontend.
 * @param locale - IETF BCP 47 language tag, e.g. "en", "hi".
 * @param state - Serializable wizard state object.
 * @param expiresAt - Hard expiration time for the row.
 * @returns The created row.
 */
export async function createState(
  reference: string,
  locale: string,
  state: object,
  expiresAt: Date,
) {
  const payload = JSON.stringify(state);
  const encryptedPayload = encryptState(payload);
  const rows = await db
    .insert(applicationState)
    .values({
      reference,
      locale,
      encryptedPayload,
      expiresAt,
    })
    .returning();
  return rows[0];
}

/**
 * Look up application state by reference and decrypt the payload.
 *
 * @param reference - Short opaque reference.
 * @returns Decrypted state object, or null if not found or expired.
 */
export async function getStateByReference(reference: string): Promise<object | null> {
  const rows = await db
    .select()
    .from(applicationState)
    .where(eq(applicationState.reference, reference))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt <= new Date()) return null;
  const plaintext = decryptState(row.encryptedPayload);
  return JSON.parse(plaintext) as object;
}

/**
 * Update an existing application_state row inside a transaction,
 * locking the row with SELECT ... FOR UPDATE before writing.
 *
 * @param reference - Short opaque reference.
 * @param state - New full wizard state object.
 * @param expiresAt - New expiration time.
 * @returns The updated row.
 */
export async function updateState(reference: string, state: object, expiresAt: Date) {
  const payload = JSON.stringify(state);
  const encryptedPayload = encryptState(payload);

  return await db.transaction(async (tx) => {
    const locked = await tx
      .select()
      .from(applicationState)
      .where(eq(applicationState.reference, reference))
      .for("update")
      .limit(1);

    if (locked.length === 0) {
      throw new Error(`Application state not found: ${reference}`);
    }

    const rows = await tx
      .update(applicationState)
      .set({
        encryptedPayload,
        expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(applicationState.reference, reference))
      .returning();

    return rows[0];
  });
}
