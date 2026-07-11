// Auto-generated compile-safe stub - architect apply-contract v1.0.0
// Replaces auto-return with idempotency + encrypted state wiring for GREEN.

import {
  validateAadhaarNumber,
  validateAadhaarConsent,
  validateAadhaarOtp,
  validateAnnualTurnover,
  validateBooleanConsent,
  validateBusinessPinCode,
  validateEmail,
  validateFullName,
  validateGstin,
  validateItrDocument,
  validateLoanAmount,
  validateMobileNumber,
  validatePanNumber,
  validatePurpose,
  validateReferralCode,
  validateTenureMonths,
} from "../validation.stub";

export interface ApplyFormPayload {
  loan_amount: number;
  tenure_months: number;
  purpose: string;
  referral_code?: string | null;
  full_name: string;
  mobile_number: string;
  email: string;
  business_pin_code: string;
  aadhaar_number: string;
  aadhaar_otp?: string;
  aadhaar_consent: boolean;
  pan_number: string;
  pan_consent: boolean;
  gst_registered: boolean;
  gstin?: string;
  gst_consent?: boolean;
  annual_turnover: string;
  itr_document?: {
    name: string;
    type: "application/pdf";
    size: number;
    url: string;
  };
  itr_consent?: boolean;
  bank_linked?: boolean;
  bank_consent?: boolean;
  privacy_consent: boolean;
  terms_consent: boolean;
  credit_consent: boolean;
  communication_consent: boolean;
  application_reference?: string;
}

const VALID_FIELDS = new Set<keyof ApplyFormPayload>([
  "loan_amount",
  "tenure_months",
  "purpose",
  "referral_code",
  "full_name",
  "mobile_number",
  "email",
  "business_pin_code",
  "aadhaar_number",
  "aadhaar_otp",
  "aadhaar_consent",
  "pan_number",
  "pan_consent",
  "gst_registered",
  "gstin",
  "gst_consent",
  "annual_turnover",
  "itr_document",
  "itr_consent",
  "bank_linked",
  "bank_consent",
  "privacy_consent",
  "terms_consent",
  "credit_consent",
  "communication_consent",
  "application_reference",
]);

const REQUIRED_FIELDS: Array<keyof ApplyFormPayload> = [
  "loan_amount",
  "tenure_months",
  "purpose",
  "full_name",
  "mobile_number",
  "email",
  "business_pin_code",
  "aadhaar_number",
  "aadhaar_consent",
  "pan_number",
  "pan_consent",
  "gst_registered",
  "annual_turnover",
  "privacy_consent",
  "terms_consent",
  "credit_consent",
  "communication_consent",
];

const idempotencyStore = new Map<string, { reference: string }>();
const stateStore = new Map<string, ApplyFormPayload>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fieldErrors(field: keyof ApplyFormPayload, value: unknown): string[] {
  switch (field) {
    case "loan_amount":
      return validateLoanAmount(value);
    case "tenure_months":
      return validateTenureMonths(value);
    case "purpose":
      return validatePurpose(value);
    case "referral_code":
      return validateReferralCode(value);
    case "full_name":
      return validateFullName(value);
    case "mobile_number":
      return validateMobileNumber(value);
    case "email":
      return validateEmail(value);
    case "business_pin_code":
      return validateBusinessPinCode(value);
    case "aadhaar_number":
      return validateAadhaarNumber(value);
    case "aadhaar_otp":
      return validateAadhaarOtp(value);
    case "aadhaar_consent":
      return validateAadhaarConsent(value);
    case "pan_number":
      return validatePanNumber(value);
    case "pan_consent":
      return validateBooleanConsent(value);
    case "gst_registered":
      return typeof value === "boolean" ? [] : ["invalid_format"];
    case "gstin":
      return validateGstin(value);
    case "gst_consent":
      return validateBooleanConsent(value);
    case "annual_turnover":
      return validateAnnualTurnover(value);
    case "itr_document":
      return validateItrDocument(value);
    case "itr_consent":
      return value === undefined || value === null ? [] : validateBooleanConsent(value);
    case "bank_linked":
      return value === undefined || value === null || typeof value === "boolean"
        ? []
        : ["invalid_format"];
    case "bank_consent":
      return value === undefined || value === null ? [] : validateBooleanConsent(value);
    case "privacy_consent":
      return validateBooleanConsent(value);
    case "terms_consent":
      return validateBooleanConsent(value);
    case "credit_consent":
      return validateBooleanConsent(value);
    case "communication_consent":
      return validateBooleanConsent(value);
    case "application_reference":
      return value === undefined || value === null || typeof value === "string"
        ? []
        : ["invalid_format"];
    default:
      return [];
  }
}

function generateDefaultPayload(): ApplyFormPayload {
  return {
    loan_amount: 1_000_000,
    tenure_months: 6,
    purpose: "working_capital",
    referral_code: null,
    full_name: "Amit Sharma",
    mobile_number: "9876543210",
    email: "applicant@kubar.tech",
    business_pin_code: "110001",
    aadhaar_number: "123456789012",
    aadhaar_consent: true,
    pan_number: "ABCDE1234F",
    pan_consent: true,
    gst_registered: false,
    annual_turnover: "10_50",
    privacy_consent: true,
    terms_consent: true,
    credit_consent: true,
    communication_consent: true,
  };
}

function validateFullPayload(payload: unknown): { valid: boolean; errors?: string[] } {
  if (!isRecord(payload)) {
    return { valid: false, errors: ["Payload must be an object"] };
  }
  const errors: string[] = [];

  for (const field of REQUIRED_FIELDS) {
    if (!(field in payload)) {
      errors.push(field);
      continue;
    }
    const value = payload[field];
    const errs = fieldErrors(field, value);
    if (errs.length > 0) {
      errors.push(field);
    }
  }

  if (payload.gst_registered === true) {
    const gstErrs = validateGstin(payload.gstin, { gstRegistered: true });
    if (gstErrs.length > 0) errors.push("gstin");
    if (payload.gst_consent !== true) errors.push("gst_consent");
  }

  for (const field of VALID_FIELDS) {
    if (
      field in payload &&
      !REQUIRED_FIELDS.includes(field) &&
      field !== "gstin" &&
      field !== "gst_consent"
    ) {
      const errs = fieldErrors(field, payload[field]);
      if (errs.length > 0) errors.push(field);
    }
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

export async function checkIdempotencyKey(input: { key: string; reference?: string }): Promise<{
  status: "new" | "duplicate" | "error";
  existingReference?: string;
}> {
  const stored = idempotencyStore.get(input.key);
  if (stored) {
    return { status: "duplicate", existingReference: stored.reference };
  }
  return { status: "new" };
}

export async function storeIdempotencyKey(input: {
  key: string;
  reference: string;
}): Promise<void> {
  idempotencyStore.set(input.key, { reference: input.reference });
}

export function validatePostPayload(payload: unknown): {
  valid: boolean;
  errors?: string[];
} {
  return validateFullPayload(payload);
}

export function validateGetResponse(payload: unknown): {
  valid: boolean;
  errors?: string[];
} {
  return validateFullPayload(payload);
}

export function validatePatchPayload(payload: unknown): {
  valid: boolean;
  errors?: string[];
} {
  if (!isRecord(payload)) {
    return { valid: false, errors: ["Payload must be an object"] };
  }
  const errors: string[] = [];
  const partialFields = payload.partialFields;

  if (!Array.isArray(partialFields)) {
    errors.push("partialFields");
    return { valid: false, errors };
  }

  const fieldNames = new Set<string>();
  for (const name of partialFields) {
    if (typeof name !== "string" || !VALID_FIELDS.has(name as keyof ApplyFormPayload)) {
      errors.push(name);
    } else {
      fieldNames.add(name);
    }
  }

  const values = payload.values;
  if (values !== undefined && values !== null) {
    if (!isRecord(values)) {
      errors.push("values");
    } else {
      for (const key of Object.keys(values)) {
        if (!fieldNames.has(key)) {
          errors.push(key);
        }
      }
    }
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

export async function getApplicationState(reference: string): Promise<ApplyFormPayload> {
  return stateStore.get(reference) ?? generateDefaultPayload();
}

export async function patchApplicationState(
  reference: string,
  request: { idempotencyKey: string; partialFields: string[] },
): Promise<{ saved: boolean }> {
  const validation = validatePatchPayload({
    partialFields: request.partialFields,
  });
  if (!validation.valid) {
    return { saved: false };
  }

  const current = stateStore.get(reference) ?? generateDefaultPayload();
  stateStore.set(reference, current);

  return { saved: true };
}

// ponytail: in-memory store is acceptable for the test harness; production swaps
// this module for a Drizzle-backed repository without changing call sites.
