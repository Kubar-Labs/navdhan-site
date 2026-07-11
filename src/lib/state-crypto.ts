/**
 * Authenticated encryption for premium apply wizard state.
 *
 * Uses AES-256-GCM with a fresh 96-bit nonce per encryption call. The key is
 * read from APPLY_ENCRYPTION_KEY as a base64-encoded 256-bit value. The
 * optional APPLY_KEY_ID defaults to "v1" and is stored inside the envelope to
 * support key rotation without re-encrypting historical rows immediately.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_ID = process.env.APPLY_KEY_ID ?? "v1";

function getKey(): Buffer {
  return resolveKey(KEY_ID, process.env.APPLY_ENCRYPTION_KEY);
}

interface Envelope {
  v: number;
  kid: string;
  iv: string;
  ct: string;
  tag: string;
}

function resolveKey(kid: string, raw?: string): Buffer {
  const candidate = raw ?? "";
  if (!candidate) {
    throw new Error(`Encryption key not configured for key ${kid}`);
  }
  const decoded = Buffer.from(candidate, "base64");
  if (decoded.length !== 32) {
    throw new Error(`Encryption key for ${kid} must be 256 bits (32 bytes)`);
  }
  return decoded;
}

/**
 * Encrypt a plaintext string and return a versioned JSON envelope.
 *
 * @param plaintext - Raw string payload (usually serialized JSON).
 * @returns JSON string containing the encrypted envelope.
 */
export function encryptState(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, getKey(), iv, { authTagLength: AUTH_TAG_LENGTH });
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const envelope: Envelope = {
    v: 1,
    kid: KEY_ID,
    iv: iv.toString("base64"),
    ct: ct.toString("base64"),
    tag: tag.toString("base64"),
  };
  return JSON.stringify(envelope);
}

/**
 * Decrypt a versioned JSON envelope produced by encryptState.
 *
 * @param envelope - JSON envelope string.
 * @returns Original plaintext string.
 * @throws Generic error on version mismatch, unknown key, or tampered data.
 */
export function decryptState(envelope: string): string {
  let parsed: Envelope;
  try {
    parsed = JSON.parse(envelope) as Envelope;
  } catch {
    throw new Error("Invalid encrypted state envelope");
  }

  if (parsed.v !== 1) {
    throw new Error(`Unsupported encrypted state version: ${parsed.v}`);
  }

  const key = resolveKey(parsed.kid, process.env.APPLY_ENCRYPTION_KEY);
  const iv = Buffer.from(parsed.iv, "base64");
  const ct = Buffer.from(parsed.ct, "base64");
  const tag = Buffer.from(parsed.tag, "base64");

  if (iv.length !== IV_LENGTH || tag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Invalid encrypted state envelope");
  }

  const decipher = createDecipheriv(ALGO, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Encrypted state could not be authenticated");
  }
}
