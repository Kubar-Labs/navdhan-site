import { isValidCsrfHeader } from "@/src/lib/apply/server/csrf";
import {
  csrfInvalidResponse,
  jsonResponse,
  sessionInvalidResponse,
  validationErrorResponse,
  type FieldError,
} from "@/src/lib/apply/server/errors";
import {
  extractSessionId,
  hashSessionId,
} from "@/src/lib/apply/server/session";
import {
  validateLoanAmount,
  validatePurpose,
  validateReferralCode,
  validateTenureMonths,
} from "@/app/apply/lib/validation";
import {
  backendUnavailableResponse,
  passBackendResponse,
  requestApplyBackend,
} from "@/src/lib/apply/server/backend-proxy";
import { enforceWriteRateLimit } from "@/src/lib/apply/server/rate-limit";

const CONSTITUTIONS = ["proprietorship", "partnership", "private_limited"] as const;
const MAX_LOAN_INTENT_BODY_BYTES = 16 * 1024;

interface LoanIntentPayload {
  constitution: (typeof CONSTITUTIONS)[number];
  requested_amount: number;
  requested_tenure_months: number;
  purpose: string;
  expected_lock_version: number;
  referral_code?: string;
}

function hasOwn(payload: Record<string, unknown>, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(payload, field);
}

async function readBoundedBody(request: Request): Promise<string | null> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const declaredLength = Number(contentLength);
    if (
      !Number.isFinite(declaredLength) ||
      declaredLength < 0 ||
      declaredLength > MAX_LOAN_INTENT_BODY_BYTES
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
    if (byteCount > MAX_LOAN_INTENT_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
}

function validateAndNormalizeLoanIntent(
  payload: Record<string, unknown>,
): { value?: LoanIntentPayload; errors: FieldError[] } {
  const errors: FieldError[] = [];
  const usesCanonicalAmount = hasOwn(payload, "requested_amount");
  const usesUiAmount = hasOwn(payload, "loan_amount");
  const usesCanonicalTenure = hasOwn(payload, "requested_tenure_months");
  const usesUiTenure = hasOwn(payload, "tenure_months");
  const usesCanonicalNames = usesCanonicalAmount && usesCanonicalTenure;
  const usesUiNames = usesUiAmount && usesUiTenure;

  if (
    (!usesCanonicalNames && !usesUiNames) ||
    (usesCanonicalAmount && usesUiAmount) ||
    (usesCanonicalTenure && usesUiTenure) ||
    (usesCanonicalAmount !== usesCanonicalTenure) ||
    (usesUiAmount !== usesUiTenure)
  ) {
    errors.push({
      field: "requested_amount",
      message_i18n_key: "apply.errors.invalidLoanIntentFields",
    });
  }

  const requestedAmount = usesCanonicalNames
    ? payload.requested_amount
    : payload.loan_amount;
  const requestedTenureMonths = usesCanonicalNames
    ? payload.requested_tenure_months
    : payload.tenure_months;

  if (
    typeof payload.constitution !== "string" ||
    !CONSTITUTIONS.includes(payload.constitution as (typeof CONSTITUTIONS)[number])
  ) {
    errors.push({
      field: "constitution",
      message_i18n_key: "apply.errors.invalidConstitution",
    });
  }
  if (!validateLoanAmount(requestedAmount)) {
    errors.push({
      field: "requested_amount",
      message_i18n_key: "apply.errors.invalidLoanAmount",
    });
  }
  if (!validateTenureMonths(requestedTenureMonths)) {
    errors.push({
      field: "requested_tenure_months",
      message_i18n_key: "apply.errors.invalidTenure",
    });
  }
  if (!validatePurpose(payload.purpose)) {
    errors.push({ field: "purpose", message_i18n_key: "apply.errors.invalidPurpose" });
  }
  if (
    !Number.isInteger(payload.expected_lock_version) ||
    Number(payload.expected_lock_version) < 0
  ) {
    errors.push({
      field: "expected_lock_version",
      message_i18n_key: "apply.errors.invalidLockVersion",
    });
  }
  if (!validateReferralCode(payload.referral_code)) {
    errors.push({
      field: "referral_code",
      message_i18n_key: "apply.errors.invalidReferralCode",
    });
  }
  if (errors.length > 0) {
    return { errors };
  }

  const value: LoanIntentPayload = {
    constitution: payload.constitution as LoanIntentPayload["constitution"],
    requested_amount: requestedAmount as number,
    requested_tenure_months: requestedTenureMonths as number,
    purpose: payload.purpose as string,
    expected_lock_version: payload.expected_lock_version as number,
  };
  if (typeof payload.referral_code === "string" && payload.referral_code.length > 0) {
    value.referral_code = payload.referral_code;
  }
  return { value, errors };
}

export async function PUT(request: Request): Promise<Response> {
  if (!isValidCsrfHeader(request)) {
    return csrfInvalidResponse();
  }
  const sessionId = extractSessionId(request.headers.get("cookie"));
  if (!sessionId) {
    return sessionInvalidResponse();
  }

  const rateLimitResponse = await enforceWriteRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  let payload: Record<string, unknown>;
  try {
    const rawBody = await readBoundedBody(request);
    if (rawBody === null) {
      return jsonResponse({ error: "PAYLOAD_TOO_LARGE" }, 413);
    }
    const body = JSON.parse(rawBody) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return validationErrorResponse([
        { field: "body", message_i18n_key: "apply.errors.invalidRequest" },
      ]);
    }
    payload = body as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "BAD_REQUEST", message: "Invalid JSON body" }, 400);
  }

  const normalized = validateAndNormalizeLoanIntent(payload);
  if (!normalized.value) {
    return validationErrorResponse(normalized.errors);
  }

  try {
    const response = await requestApplyBackend(
      "/api/apply/applications/current/loan-intent",
      {
        method: "PUT",
        sessionDigest: hashSessionId(sessionId),
        body: normalized.value,
      },
    );
    return passBackendResponse(response);
  } catch {
    return backendUnavailableResponse();
  }
}
