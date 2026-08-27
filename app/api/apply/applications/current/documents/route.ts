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
import { enforceUploadRateLimit } from "@/src/lib/apply/server/rate-limit";

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
// Multipart boundaries and field metadata add a small amount beyond the PDF
// itself. Bound the complete request too so a missing/forged Content-Length
// cannot make `formData()` buffer an arbitrarily large body in the Worker.
const MAX_MULTIPART_OVERHEAD_BYTES = 64 * 1024;
const MAX_UPLOAD_REQUEST_BYTES = MAX_UPLOAD_BYTES + MAX_MULTIPART_OVERHEAD_BYTES;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isUuid(value: FormDataEntryValue | null): value is string {
  return typeof value === "string" && isSafePartyId(value);
}

function isValidDateField(value: FormDataEntryValue | null): value is string | null {
  if (value === null) return true;
  return typeof value === "string" && DATE_RE.test(value);
}

async function readBoundedFormData(request: Request): Promise<FormData | null> {
  if (!request.body) throw new Error("Missing form body");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteCount = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteCount += value.byteLength;
    if (byteCount > MAX_UPLOAD_REQUEST_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(byteCount);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const contentType = request.headers.get("content-type");
  if (!contentType) throw new Error("Missing content type");
  return new Response(body, { headers: { "content-type": contentType } }).formData();
}

export async function POST(request: Request): Promise<Response> {
  if (!isValidCsrfHeader(request)) return csrfInvalidResponse();

  const sessionId = extractSessionId(request.headers.get("cookie"));
  if (!sessionId) return sessionInvalidResponse();

  const rateLimitResponse = await enforceUploadRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const declared = Number(contentLength);
    if (!Number.isFinite(declared) || declared < 0 || declared > MAX_UPLOAD_REQUEST_BYTES) {
      return jsonResponse({ error: "PAYLOAD_TOO_LARGE" }, 413);
    }
  }

  let incoming: FormData;
  try {
    const formData = await readBoundedFormData(request);
    if (formData === null) {
      return jsonResponse({ error: "PAYLOAD_TOO_LARGE" }, 413);
    }
    incoming = formData;
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
