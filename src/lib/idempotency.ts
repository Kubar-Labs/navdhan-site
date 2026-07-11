/**
 * Race-safe idempotency helper.
 *
 * Targets the existing idempotency_keys table in src/db/schema.ts and its
 * partial unique index idx_idempotency_keys_lookup on (key_hash, scope) where
 * expires_at > now(). A mismatched-payload retry must *not* overwrite the
 * winner's cached response under a race, so the write path uses
 * ON CONFLICT DO NOTHING and the caller compares payload_hash afterwards.
 */

import { eq, and, gt, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { idempotencyKeys } from "@/src/db/schema";

export interface IdempotencyRecord {
  id: string;
  keyHash: string;
  scope: string;
  requestPath: string;
  payloadHash: string;
  responseStatus: number;
  responseBody: unknown;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Store an idempotency result in a race-safe way.
 *
 * @param keyHash - SHA-256 hash of the Idempotency-Key header.
 * @param scope - Request scope (e.g. route or mutation name).
 * @param requestPath - Path of the request.
 * @param payloadHash - Hash of the normalized request payload.
 * @param responseStatus - HTTP status of the cached response.
 * @param responseBody - Serializable response body.
 * @param expiresAt - Expiration time.
 * @returns The inserted record, or null if an unexpired conflict already existed.
 */
export async function storeIdempotencyResult(
  keyHash: string,
  scope: string,
  requestPath: string,
  payloadHash: string,
  responseStatus: number,
  responseBody: unknown,
  expiresAt: Date,
): Promise<IdempotencyRecord | null> {
  const rows = await db
    .insert(idempotencyKeys)
    .values({
      keyHash,
      scope,
      requestPath,
      payloadHash,
      responseStatus,
      responseBody,
      expiresAt,
    })
    .onConflictDoNothing({ target: [idempotencyKeys.keyHash, idempotencyKeys.scope] })
    .returning();
  return (rows[0] as IdempotencyRecord | undefined) ?? null;
}

/**
 * Look up a live idempotency record by key hash and scope.
 *
 * @param keyHash - Hash of the Idempotency-Key header.
 * @param scope - Request scope.
 * @returns The cached record if found and not expired, otherwise null.
 */
export async function lookupIdempotencyResult(
  keyHash: string,
  scope: string,
): Promise<IdempotencyRecord | null> {
  const rows = await db
    .select()
    .from(idempotencyKeys)
    .where(
      and(
        eq(idempotencyKeys.keyHash, keyHash),
        eq(idempotencyKeys.scope, scope),
        gt(idempotencyKeys.expiresAt, sql`now()`),
      ),
    )
    .limit(1);
  return (rows[0] as IdempotencyRecord | undefined) ?? null;
}
