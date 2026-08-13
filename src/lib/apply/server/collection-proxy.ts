import {
  backendUnavailableResponse,
  passBackendResponse,
  requestApplyBackend,
} from "./backend-proxy";
import { isValidCsrfHeader } from "./csrf";
import {
  csrfInvalidResponse,
  jsonResponse,
  sessionInvalidResponse,
  validationErrorResponse,
  type FieldError,
} from "./errors";
import { extractSessionId, hashSessionId } from "./session";

const MAX_COLLECTION_BODY_BYTES = 16 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CollectionValidationResult<T> {
  value?: T;
  errors: FieldError[];
}

export type CollectionPayloadValidator<T> = (input: unknown) => CollectionValidationResult<T>;

async function readBoundedBody(request: Request): Promise<string | null> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const declaredLength = Number(contentLength);
    if (
      !Number.isFinite(declaredLength) ||
      declaredLength < 0 ||
      declaredLength > MAX_COLLECTION_BODY_BYTES
    ) {
      return null;
    }
  }

  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let byteCount = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteCount += value.byteLength;
    if (byteCount > MAX_COLLECTION_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

export function isSafePartyId(value: string): boolean {
  return UUID_RE.test(value);
}

export async function proxyCollectionWrite<T>(
  request: Request,
  backendPath: string,
  validate: CollectionPayloadValidator<T>,
  method: "POST" | "PUT" = "PUT",
): Promise<Response> {
  if (!isValidCsrfHeader(request)) return csrfInvalidResponse();

  const sessionId = extractSessionId(request.headers.get("cookie"));
  if (!sessionId) return sessionInvalidResponse();

  let input: unknown;
  try {
    const rawBody = await readBoundedBody(request);
    if (rawBody === null) {
      return jsonResponse({ error: "PAYLOAD_TOO_LARGE" }, 413);
    }
    input = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: "BAD_REQUEST", message: "Invalid JSON body" }, 400);
  }

  const result = validate(input);
  if (!result.value) return validationErrorResponse(result.errors);

  try {
    const response = await requestApplyBackend(backendPath, {
      method,
      sessionDigest: hashSessionId(sessionId),
      body: result.value,
    });
    return passBackendResponse(response);
  } catch {
    return backendUnavailableResponse();
  }
}
