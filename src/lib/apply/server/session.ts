/**
 * Session cookie helpers for the apply portal.
 */

import { createHash } from "crypto";

const SESSION_COOKIE_NAME = "__Host-nd_session";

export function extractSessionId(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  return match?.[1]?.trim() ?? null;
}

export function hashSessionId(sessionId: string): string {
  return createHash("sha256").update(sessionId).digest("hex");
}
