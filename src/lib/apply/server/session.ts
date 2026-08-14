/**
 * Session cookie helpers for the apply portal.
 */

import { createHash, randomBytes } from "crypto";

// `__Host-` is a browser-enforced cookie prefix: it requires the `Secure`
// attribute, which in turn requires HTTPS. Local dev serves the app over
// plain http://localhost, so a `Secure` cookie set there is silently
// dropped by the browser — every request after session creation comes back
// unauthenticated. Use the `__Host-` prefixed, Secure cookie in production
// (per the plan's "Secure in production" note) and a plain-named,
// non-Secure cookie in dev so the same-browser session actually persists
// locally. `extractSessionId` accepts either name so a single deployment
// reading its own just-issued cookie always works.
const SESSION_COOKIE_NAME_SECURE = "__Host-nd_session";
const SESSION_COOKIE_NAME_DEV = "nd_session";
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
    if (name !== SESSION_COOKIE_NAME_SECURE && name !== SESSION_COOKIE_NAME_DEV) continue;
    const value = pair.slice(separatorIndex + 1).trim();
    return value || null;
  }
  return null;
}

export function hashSessionId(sessionId: string): string {
  return createHash("sha256").update(sessionId).digest("hex");
}

export function serializeSessionCookie(sessionId: string): string {
  const isProduction = process.env.NODE_ENV === "production";
  const name = isProduction ? SESSION_COOKIE_NAME_SECURE : SESSION_COOKIE_NAME_DEV;
  return [
    `${name}=${sessionId}`,
    "HttpOnly",
    ...(isProduction ? ["Secure"] : []),
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
  ].join("; ");
}
