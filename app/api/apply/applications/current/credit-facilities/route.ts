import { validateCreditFacility } from "@/app/apply/lib/validation";
import {
  backendUnavailableResponse,
  passBackendResponse,
  requestApplyBackend,
} from "@/src/lib/apply/server/backend-proxy";
import { proxyCollectionWrite } from "@/src/lib/apply/server/collection-proxy";
import { sessionInvalidResponse } from "@/src/lib/apply/server/errors";
import { extractSessionId, hashSessionId } from "@/src/lib/apply/server/session";

export async function GET(request: Request): Promise<Response> {
  const sessionId = extractSessionId(request.headers.get("cookie"));
  if (!sessionId) {
    return sessionInvalidResponse();
  }

  try {
    const response = await requestApplyBackend(
      "/api/apply/applications/current/credit-facilities",
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

export function POST(request: Request): Promise<Response> {
  return proxyCollectionWrite(
    request,
    "/api/apply/applications/current/credit-facilities",
    validateCreditFacility,
    "POST",
  );
}
