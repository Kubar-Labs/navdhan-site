import {
  extractSessionId,
  hashSessionId,
} from "@/src/lib/apply/server/session";
import { sessionInvalidResponse } from "@/src/lib/apply/server/errors";
import {
  backendUnavailableResponse,
  passBackendResponse,
  requestApplyBackend,
} from "@/src/lib/apply/server/backend-proxy";
import { enforceReadRateLimit } from "@/src/lib/apply/server/rate-limit";

export async function GET(request: Request): Promise<Response> {
  const sessionId = extractSessionId(request.headers.get("cookie"));
  if (!sessionId) {
    return sessionInvalidResponse();
  }

  const rateLimitResponse = await enforceReadRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const response = await requestApplyBackend(
      "/api/apply/applications/current/requirements",
      {
        method: "GET",
        sessionDigest: hashSessionId(sessionId),
      },
    );
    return passBackendResponse(response);
  } catch {
    return backendUnavailableResponse();
  }
}
