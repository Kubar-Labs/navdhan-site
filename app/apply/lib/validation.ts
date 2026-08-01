export const PURPOSE_OPTIONS = [
  "working_capital",
  "machinery",
  "inventory",
  "business_expansion",
  "debt_refinancing",
  "other",
] as const;

export type Purpose = (typeof PURPOSE_OPTIONS)[number];

export const LOAN_AMOUNT_MIN = 500_000;
export const LOAN_AMOUNT_MAX = 10_000_000;
export const LOAN_AMOUNT_STEP = 10_000;
export const TENURE_MIN = 3;
export const TENURE_MAX = 12;

export const TURNOVER_CHOICES = ["0_10", "10_50", "50_100", "100_500", "500_plus"] as const;

export type AnnualTurnoverRange = (typeof TURNOVER_CHOICES)[number];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

export function validateLoanAmount(value: unknown): boolean {
  if (!Number.isInteger(value)) return false;
  const n = Number(value);
  return n >= LOAN_AMOUNT_MIN && n <= LOAN_AMOUNT_MAX && n % LOAN_AMOUNT_STEP === 0;
}

export function validateTenureMonths(value: unknown): boolean {
  if (!Number.isInteger(value)) return false;
  const n = Number(value);
  return n >= TENURE_MIN && n <= TENURE_MAX;
}

export function validatePurpose(value: unknown): boolean {
  return typeof value === "string" && (PURPOSE_OPTIONS as readonly string[]).includes(value);
}

export function validateReferralCode(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return true;
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > 20) return false;
  return /^[A-Za-z0-9_-]+$/.test(value);
}

export function validateFullName(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > 150) return false;
  return /^[A-Za-z\s'.-]+$/.test(trimmed);
}

export function validateMobileNumber(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /^[6-9]\d{9}$/.test(value);
}

export function validateEmail(value: unknown): boolean {
  if (typeof value !== "string") return false;
  if (value.length > 255) return false;
  return EMAIL_RE.test(value);
}

export function validateBusinessPinCode(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /^[1-9]\d{5}$/.test(value);
}

export function validateAadhaarNumber(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /^\d{12}$/.test(value);
}

export function validateAadhaarOtp(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /^\d{6}$/.test(value);
}

export function validatePanNumber(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value);
}

export function validateGstin(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return true;
  if (typeof value !== "string") return false;
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[1-9A-Z]$/.test(value);
}

export function validateAnnualTurnover(value: unknown): boolean {
  return typeof value === "string" && (TURNOVER_CHOICES as readonly string[]).includes(value);
}

export const TURNOVER_RANGES: Record<AnnualTurnoverRange, string> = {
  "0_10": "₹10 Lakhs",
  "10_50": "₹10 - ₹50 Lakhs",
  "50_100": "₹50 Lakhs - ₹1 Crore",
  "100_500": "₹1 - ₹5 Crore",
  "500_plus": "₹5 Crore+",
};
