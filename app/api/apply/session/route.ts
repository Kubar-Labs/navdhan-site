import {
  generateSessionId,
  hashSessionId,
  serializeOppositeSessionCookieExpiry,
  serializeSessionCookie,
} from "@/src/lib/apply/server/session";
import { isValidCsrfHeader } from "@/src/lib/apply/server/csrf";
import { csrfInvalidResponse, jsonResponse } from "@/src/lib/apply/server/errors";
import {
  backendUnavailableResponse,
  passBackendResponse,
  requestApplyBackend,
} from "@/src/lib/apply/server/backend-proxy";
import { enforceSessionRateLimit } from "@/src/lib/apply/server/rate-limit";

function removeSessionSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(removeSessionSecrets);
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !["token", "raw_token", "session_token", "token_digest"].includes(key))
      .map(([key, child]) => [key, removeSessionSecrets(child)]),
  );
}

async function safeSessionResponse(response: Response): Promise<Response> {
  if (!response.ok) {
    return passBackendResponse(response);
  }
  const contentType = response.headers.get("content-type")?.toLowerCase();
  if (!contentType?.includes("application/json")) {
    return passBackendResponse(response);
  }

  try {
    const payload = removeSessionSecrets(await response.json());
    return jsonResponse(payload, response.status);
  } catch {
    return jsonResponse({ error: "BACKEND_INVALID_RESPONSE" }, 502);
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!isValidCsrfHeader(request)) {
    return csrfInvalidResponse();
  }

  const rateLimitResponse = await enforceSessionRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  const sessionId = generateSessionId();
  const tokenDigest = hashSessionId(sessionId);

  try {
    const backendResponse = await requestApplyBackend("/api/apply/session", {
      method: "POST",
      body: { token_digest: tokenDigest },
    });
    const response = await safeSessionResponse(backendResponse);
    if (response.ok) {
      response.headers.append("set-cookie", serializeSessionCookie(sessionId));
      response.headers.append("set-cookie", serializeOppositeSessionCookieExpiry());
    }
    return response;
  } catch {
    return backendUnavailableResponse();
  }
}
