/**
 * Standard JSON error response builders.
 */

export function jsonResponse(
  body: unknown,
  status = 200,
  headers?: HeadersInit,
): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("cache-control", "no-store");
  responseHeaders.set("pragma", "no-cache");
  return Response.json(body, { status, headers: responseHeaders });
}

export function sessionInvalidResponse(): Response {
  return jsonResponse(
    {
      error: "SESSION_INVALID",
      message_i18n_key: "apply.errors.sessionExpired",
    },
    401,
  );
}

export function csrfInvalidResponse(): Response {
  return jsonResponse({ error: "CSRF_INVALID" }, 403);
}

export function rateLimitedResponse(retryAfterSeconds = 60): Response {
  return jsonResponse(
    { error: "RATE_LIMITED", retry_after_seconds: retryAfterSeconds },
    429,
    { "retry-after": String(retryAfterSeconds) },
  );
}

export function intakePausedResponse(): Response {
  return jsonResponse(
    {
      error: "INTAKE_PAUSED",
      message_i18n_key: "apply.errors.intakePaused",
    },
    503,
    { "retry-after": "3600" },
  );
}

export interface FieldError {
  field: string;
  message_i18n_key: string;
  params?: Record<string, unknown>;
}

export function validationErrorResponse(
  fieldErrors: FieldError[],
  extra?: Record<string, unknown>,
): Response {
  return jsonResponse(
    { error: "VALIDATION_ERROR", field_errors: fieldErrors, ...extra },
    400,
  );
}

export function idempotencyRequiredResponse(): Response {
  return jsonResponse({ error: "IDEMPOTENCY_KEY_REQUIRED" }, 400);
}

export function idempotencyConflictResponse(): Response {
  return jsonResponse({ error: "IDEMPOTENCY_KEY_CONFLICT" }, 409);
}
