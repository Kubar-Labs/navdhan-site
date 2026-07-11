/**
 * Standard JSON error response builders.
 */

export function jsonResponse(
  body: unknown,
  status = 200,
): Response {
  return Response.json(body, { status });
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
