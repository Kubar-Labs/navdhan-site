import {
  generateSessionId,
  hashSessionId,
  serializeSessionCookie,
} from "@/src/lib/apply/server/session";
import { isValidCsrfHeader } from "@/src/lib/apply/server/csrf";
import { csrfInvalidResponse } from "@/src/lib/apply/server/errors";
import {
  backendUnavailableResponse,
  passBackendResponse,
  requestApplyBackend,
} from "@/src/lib/apply/server/backend-proxy";

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
  if (response.status >= 500) {
    return passBackendResponse(response);
  }
  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    return passBackendResponse(response);
  }

  try {
    const payload = removeSessionSecrets(await response.json());
    return Response.json(payload, { status: response.status });
  } catch {
    return Response.json({ error: "BACKEND_INVALID_RESPONSE" }, { status: 502 });
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!isValidCsrfHeader(request)) {
    return csrfInvalidResponse();
  }

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
    }
    return response;
  } catch {
    return backendUnavailableResponse();
  }
}
