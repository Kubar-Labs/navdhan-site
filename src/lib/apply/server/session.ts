/**
 * Session cookie helpers for the apply portal.
 */

import { createHash, randomBytes } from "crypto";

const SESSION_COOKIE_NAME = "__Host-nd_session";
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export function generateSessionId(): string {
  return randomBytes(32).toString("base64url");
}

export function extractSessionId(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const pair of cookieHeader.split(";")) {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex < 0) continue;
    const name = pair.slice(0, separatorIndex).trim();
    if (name !== SESSION_COOKIE_NAME) continue;
    const value = pair.slice(separatorIndex + 1).trim();
    return value || null;
  }
  return null;
}

export function hashSessionId(sessionId: string): string {
  return createHash("sha256").update(sessionId).digest("hex");
}

export function serializeSessionCookie(sessionId: string): string {
  return [
    `${SESSION_COOKIE_NAME}=${sessionId}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
  ].join("; ");
}
