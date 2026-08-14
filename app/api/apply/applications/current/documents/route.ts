import { isValidCsrfHeader } from "@/src/lib/apply/server/csrf";
import {
  backendUnavailableResponse,
  passBackendResponse,
  requestApplyBackendForm,
} from "@/src/lib/apply/server/backend-proxy";
import {
  csrfInvalidResponse,
  jsonResponse,
  sessionInvalidResponse,
  validationErrorResponse,
} from "@/src/lib/apply/server/errors";
import { extractSessionId, hashSessionId } from "@/src/lib/apply/server/session";
import { isSafePartyId } from "@/src/lib/apply/server/collection-proxy";

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isUuid(value: FormDataEntryValue | null): value is string {
  return typeof value === "string" && isSafePartyId(value);
}

function isValidDateField(value: FormDataEntryValue | null): value is string | null {
  if (value === null) return true;
  return typeof value === "string" && DATE_RE.test(value);
}

export async function POST(request: Request): Promise<Response> {
  if (!isValidCsrfHeader(request)) return csrfInvalidResponse();

  const sessionId = extractSessionId(request.headers.get("cookie"));
  if (!sessionId) return sessionInvalidResponse();

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const declared = Number(contentLength);
    if (!Number.isFinite(declared) || declared < 0 || declared > MAX_UPLOAD_BYTES) {
      return jsonResponse({ error: "PAYLOAD_TOO_LARGE" }, 413);
    }
  }

  let incoming: FormData;
  try {
    incoming = await request.formData();
  } catch {
    return jsonResponse({ error: "BAD_REQUEST", message: "Invalid form body" }, 400);
  }

  const file = incoming.get("file");
  const applicationRequirementId = incoming.get("application_requirement_id");
  const expectedLockVersionRaw = incoming.get("expected_lock_version");
  const coverageFrom = incoming.get("coverage_from");
  const coverageTo = incoming.get("coverage_to");
  const supersedesDocumentId = incoming.get("supersedes_document_id");

  const errors: { field: string; message_i18n_key: string }[] = [];
  if (!(file instanceof File) || file.size === 0) {
    errors.push({ field: "file", message_i18n_key: "apply.errors.invalidFile" });
  } else if (file.size > MAX_UPLOAD_BYTES) {
    return jsonResponse({ error: "PAYLOAD_TOO_LARGE" }, 413);
  }
  if (!isUuid(applicationRequirementId)) {
    errors.push({
      field: "application_requirement_id",
      message_i18n_key: "apply.errors.invalidRequest",
    });
  }
  const expectedLockVersion = Number(expectedLockVersionRaw);
  if (!Number.isInteger(expectedLockVersion) || expectedLockVersion < 0) {
    errors.push({
      field: "expected_lock_version",
      message_i18n_key: "apply.errors.invalidLockVersion",
    });
  }
  if (!isValidDateField(coverageFrom)) {
    errors.push({ field: "coverage_from", message_i18n_key: "apply.errors.invalidRequest" });
  }
  if (!isValidDateField(coverageTo)) {
    errors.push({ field: "coverage_to", message_i18n_key: "apply.errors.invalidRequest" });
  }
  if (supersedesDocumentId !== null && !isUuid(supersedesDocumentId)) {
    errors.push({
      field: "supersedes_document_id",
      message_i18n_key: "apply.errors.invalidRequest",
    });
  }
  if (errors.length > 0) return validationErrorResponse(errors);

  const outgoing = new FormData();
  outgoing.set("file", file as File, (file as File).name);
  outgoing.set("application_requirement_id", applicationRequirementId as string);
  outgoing.set("expected_lock_version", String(expectedLockVersion));
  if (typeof coverageFrom === "string") outgoing.set("coverage_from", coverageFrom);
  if (typeof coverageTo === "string") outgoing.set("coverage_to", coverageTo);
  if (typeof supersedesDocumentId === "string")
    outgoing.set("supersedes_document_id", supersedesDocumentId);

  try {
    const response = await requestApplyBackendForm("/api/apply/applications/current/documents", {
      method: "POST",
      sessionDigest: hashSessionId(sessionId),
      formData: outgoing,
    });
    return passBackendResponse(response);
  } catch {
    return backendUnavailableResponse();
  }
}
