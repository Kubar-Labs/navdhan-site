import { isValidCsrfHeader } from "@/src/lib/apply/server/csrf";
import {
  backendUnavailableResponse,
  passBackendResponse,
  requestApplyBackend,
} from "@/src/lib/apply/server/backend-proxy";
import {
  csrfInvalidResponse,
  sessionInvalidResponse,
  validationErrorResponse,
} from "@/src/lib/apply/server/errors";
import { extractSessionId, hashSessionId } from "@/src/lib/apply/server/session";
import { isSafePartyId } from "@/src/lib/apply/server/collection-proxy";

interface RouteContext {
  params: Promise<{ documentId: string }>;
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  if (!isValidCsrfHeader(request)) return csrfInvalidResponse();

  const sessionId = extractSessionId(request.headers.get("cookie"));
  if (!sessionId) return sessionInvalidResponse();

  const { documentId } = await context.params;
  if (!isSafePartyId(documentId)) {
    return validationErrorResponse([
      { field: "document_id", message_i18n_key: "apply.errors.invalidRequest" },
    ]);
  }

  const expectedLockVersion = new URL(request.url).searchParams.get("expected_lock_version");
  const lockVersion = Number(expectedLockVersion);
  if (!Number.isInteger(lockVersion) || lockVersion < 0) {
    return validationErrorResponse([
      { field: "expected_lock_version", message_i18n_key: "apply.errors.invalidLockVersion" },
    ]);
  }

  try {
    const response = await requestApplyBackend(
      `/api/apply/applications/current/documents/${documentId}?expected_lock_version=${lockVersion}`,
      {
        method: "DELETE",
        sessionDigest: hashSessionId(sessionId),
      },
    );
    return passBackendResponse(response);
  } catch {
    return backendUnavailableResponse();
  }
}
