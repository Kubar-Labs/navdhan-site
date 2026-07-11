/**
 * Shared helpers for /api/apply stub route handlers.
 */

import { randomUUID } from "crypto";
import { isValidCsrfHeader } from "@/src/lib/apply/server/csrf";
import { extractSessionId } from "@/src/lib/apply/server/session";
import {
  csrfInvalidResponse,
  sessionInvalidResponse,
  validationErrorResponse,
} from "@/src/lib/apply/server/errors";
import { getOrCreateApplication } from "@/src/lib/apply/server/store";
import { APPLICATION_STEPS, type ApplicationStep } from "@/src/types/apply";
import {
  validateLoanAmount,
  validateTenureMonths,
  validatePurpose,
  validateReferralCode,
  validateFullName,
  validateMobileNumber,
  validateEmail,
  validateBusinessPinCode,
  validateAadhaarNumber,
  validateAadhaarOtp,
  validatePanNumber,
  validateGstin,
} from "@/app/apply/lib/validation";

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export interface FieldError {
  field: string;
  message_i18n_key: string;
}

export async function gateRequest(
  request: Request,
): Promise<
  | { ok: true; sessionId: string; application: ReturnType<typeof getOrCreateApplication> }
  | { ok: false; response: Response }
> {
  if (!isValidCsrfHeader(request) && request.method !== "GET") {
    return { ok: false, response: csrfInvalidResponse() };
  }
  const sessionId = extractSessionId(request.headers.get("cookie"));
  if (!sessionId) {
    return { ok: false, response: sessionInvalidResponse() };
  }
  const application = getOrCreateApplication(sessionId);
  return { ok: true, sessionId, application };
}

export function gateGetRequest(
  request: Request,
): Promise<
  | { ok: true; sessionId: string; application: ReturnType<typeof getOrCreateApplication> }
  | { ok: false; response: Response }
> {
  const sessionId = extractSessionId(request.headers.get("cookie"));
  if (!sessionId) {
    return Promise.resolve({ ok: false, response: sessionInvalidResponse() });
  }
  const application = getOrCreateApplication(sessionId);
  return Promise.resolve({ ok: true, sessionId, application });
}

export function nextStep(currentStep: ApplicationStep): ApplicationStep | null {
  const index = APPLICATION_STEPS.indexOf(currentStep);
  if (index < 0 || index >= APPLICATION_STEPS.length - 1) return null;
  return APPLICATION_STEPS[index + 1] ?? null;
}

export function isApplicationStep(value: unknown): value is ApplicationStep {
  return typeof value === "string" && APPLICATION_STEPS.includes(value as ApplicationStep);
}

export function validateLoanIntentPayload(payload: Record<string, unknown>): FieldError[] {
  const errors: FieldError[] = [];
  if (!validateLoanAmount(payload.loan_amount)) {
    errors.push({ field: "loan_amount", message_i18n_key: "apply.errors.invalidLoanAmount" });
  }
  if (!validateTenureMonths(payload.tenure_months)) {
    errors.push({ field: "tenure_months", message_i18n_key: "apply.errors.invalidTenure" });
  }
  if (!validatePurpose(payload.purpose)) {
    errors.push({ field: "purpose", message_i18n_key: "apply.errors.invalidPurpose" });
  }
  if (!validateReferralCode(payload.referral_code)) {
    errors.push({ field: "referral_code", message_i18n_key: "apply.errors.invalidReferralCode" });
  }
  return errors;
}

export function validatePersonalContactPayload(payload: Record<string, unknown>): FieldError[] {
  const errors: FieldError[] = [];
  if (!validateFullName(payload.full_name)) {
    errors.push({ field: "full_name", message_i18n_key: "apply.errors.invalidFullName" });
  }
  if (!validateMobileNumber(payload.mobile_number)) {
    errors.push({ field: "mobile_number", message_i18n_key: "apply.errors.invalidMobile" });
  }
  if (!validateEmail(payload.email)) {
    errors.push({ field: "email", message_i18n_key: "apply.errors.invalidEmail" });
  }
  if (!validateBusinessPinCode(payload.business_pin_code)) {
    errors.push({ field: "business_pin_code", message_i18n_key: "apply.errors.invalidPinCode" });
  }
  return errors;
}

export function validateAadhaarPayload(payload: Record<string, unknown>): FieldError[] {
  const errors: FieldError[] = [];
  if (!validateAadhaarNumber(payload.aadhaar_number)) {
    errors.push({ field: "aadhaar_number", message_i18n_key: "apply.errors.invalidAadhaar" });
  }
  if (payload.aadhaar_otp && !validateAadhaarOtp(payload.aadhaar_otp)) {
    errors.push({ field: "aadhaar_otp", message_i18n_key: "apply.errors.invalidOtp" });
  }
  return errors;
}

export function validatePanPayload(payload: Record<string, unknown>): FieldError[] {
  const errors: FieldError[] = [];
  if (!validatePanNumber(payload.pan_number)) {
    errors.push({ field: "pan_number", message_i18n_key: "apply.errors.invalidPan" });
  }
  return errors;
}

export function validateGstPayload(payload: Record<string, unknown>): FieldError[] {
  const errors: FieldError[] = [];
  if (payload.gstin_skipped === true) return errors;
  if (!validateGstin(payload.gstin)) {
    errors.push({ field: "gstin", message_i18n_key: "apply.errors.invalidGstin" });
  }
  return errors;
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function badRequestResponse(message = "Invalid request", code = "BAD_REQUEST"): Response {
  return jsonResponse({ error: code, message }, 400);
}

export { randomUUID, validationErrorResponse };
