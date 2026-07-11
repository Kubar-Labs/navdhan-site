// Auto-generated compile-safe stub - architect apply-contract v1.0.0
// Replaces auto-return with real validators for the GREEN phase.

const MOBILE_RE = /^[6-9]\d{9}$/;
const AADHAAR_RE = /^\d{12}$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[1-9A-Z]$/;
const PIN_CODE_RE = /^[1-9]\d{5}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
const NAME_RE = /^[A-Za-z\s'.-]+$/;
const REFERRAL_RE = /^[A-Za-z0-9_-]+$/;

export const TURNOVER_CHOICES = ["0_10", "10_50", "50_100", "100_500", "500_plus"] as const;

function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function validateAadhaarNumber(value: unknown): string[] {
  return isString(value) && AADHAAR_RE.test(value) ? [] : ["invalid_format"];
}

export function validateAadhaarConsent(value: unknown): string[] {
  return value === true ? [] : ["consent_missing"];
}

export function validateMobileNumber(value: unknown): string[] {
  return isString(value) && MOBILE_RE.test(value) ? [] : ["invalid_format"];
}

export function validatePanNumber(value: unknown): string[] {
  return isString(value) && PAN_RE.test(value) ? [] : ["invalid_format"];
}

export function validateGstin(value: unknown, options?: { gstRegistered?: boolean }): string[] {
  if (!options?.gstRegistered) return [];
  if (value === null || value === undefined || value === "") return ["required"];
  return isString(value) && GSTIN_RE.test(value) ? [] : ["invalid_format"];
}

export function validateAnnualTurnover(value: unknown): string[] {
  return isString(value) && (TURNOVER_CHOICES as readonly string[]).includes(value)
    ? []
    : ["invalid_choice"];
}

// Other field validators used by route handlers / full-payload checks.

export function validateFullName(value: unknown): string[] {
  if (!isString(value)) return ["invalid_format"];
  const trimmed = value.trim();
  if (trimmed.length < 2) return ["too_short"];
  if (trimmed.length > 150) return ["too_long"];
  return NAME_RE.test(trimmed) ? [] : ["invalid_format"];
}

export function validateEmail(value: unknown): string[] {
  if (!isString(value)) return ["invalid_format"];
  if (value.length > 255) return ["invalid_format"];
  return EMAIL_RE.test(value) ? [] : ["invalid_format"];
}

export function validateLoanAmount(value: unknown): string[] {
  if (!Number.isInteger(value)) return ["out_of_range"];
  const n = Number(value);
  if (n < 500000 || n > 10000000) return ["out_of_range"];
  if (n % 10000 !== 0) return ["out_of_range"];
  return [];
}

export function validateTenureMonths(value: unknown): string[] {
  if (!Number.isInteger(value)) return ["out_of_range"];
  const n = Number(value);
  if (n < 3 || n > 12) return ["out_of_range"];
  return [];
}

export function validatePurpose(value: unknown): string[] {
  const PURPOSES = [
    "working_capital",
    "machinery",
    "inventory",
    "business_expansion",
    "debt_refinancing",
    "other",
  ];
  return isString(value) && PURPOSES.includes(value) ? [] : ["invalid_choice"];
}

export function validateReferralCode(value: unknown): string[] {
  if (value === null || value === undefined || value === "") return [];
  if (!isString(value)) return ["invalid_format"];
  if (value.length === 0 || value.length > 20) return ["invalid_format"];
  return REFERRAL_RE.test(value) ? [] : ["invalid_format"];
}

export function validateBusinessPinCode(value: unknown): string[] {
  return isString(value) && PIN_CODE_RE.test(value) ? [] : ["invalid_format"];
}

export function validateAadhaarOtp(value: unknown): string[] {
  return isString(value) && /^\d{6}$/.test(value) ? [] : ["invalid_format"];
}

export function validateBooleanConsent(value: unknown): string[] {
  return value === true ? [] : ["consent_missing"];
}

export function validateItrDocument(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value !== "object" || value === null) return ["invalid_format"];
  const doc = value as Record<string, unknown>;
  if (doc.type !== "application/pdf") return ["invalid_format"];
  if (typeof doc.size !== "number" || doc.size <= 0 || doc.size > 10485760) {
    return ["out_of_range"];
  }
  if (!isString(doc.url)) return ["invalid_format"];
  try {
    // eslint-disable-next-line no-new
    new URL(doc.url);
    return [];
  } catch {
    return ["invalid_format"];
  }
}

// Backward-compatible aliases for older consumers.

export function validatePhone(value: unknown): string[] {
  return validateMobileNumber(value);
}

export function validateAadhaar(value: unknown): string[] {
  return validateAadhaarNumber(value);
}

export function validatePan(value: unknown): string[] {
  return validatePanNumber(value);
}

export function validateOtp(value: unknown): string[] {
  return validateAadhaarOtp(value);
}

export function validateRequestedAmount(value: unknown): string[] {
  return validateLoanAmount(value);
}

export function validateLoanPurpose(value: unknown): string[] {
  return validatePurpose(value);
}

export function validateBankStatementMonths(value: unknown): string[] {
  if (!Number.isInteger(value)) return ["out_of_range"];
  const n = Number(value);
  return n >= 6 && n <= 12 ? [] : ["out_of_range"];
}

export function validateDocumentType(value: unknown): string[] {
  const TYPES = ["itr", "bank_statement", "gst_return", "other"];
  return isString(value) && TYPES.includes(value) ? [] : ["invalid_choice"];
}

export function validateFinalConsents(value: unknown): string[] {
  if (typeof value !== "object" || value === null) return ["consent_missing"];
  const c = value as Record<string, unknown>;
  const required = ["terms", "privacy", "credit_bureau"];
  for (const key of required) {
    if (c[key] !== true) return ["consent_missing"];
  }
  return [];
}
