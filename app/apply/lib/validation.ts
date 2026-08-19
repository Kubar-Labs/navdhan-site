import type {
  AadhaarIdentityPayload,
  ApplicationPartyRole,
  BusinessProfilePayload,
  BusinessTypeCode,
  ConsentGrantPayload,
  CreditDeclarationPayload,
  CreditFacilityPayload,
  EmploymentStatusCode,
  EntityPanPayload,
  FacilityType,
  GstRegistrationPayload,
  IncomeTypeCode,
  LocationTier,
  OfficeType,
  PanIdentityPayload,
  PartyPayload,
  PartyUpdatePayload,
  PersonPayload,
  ResidenceType,
  SubmitApplicationPayload,
} from "./types";

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

const BUSINESS_TYPE_CODES = ["trading", "manufacturing", "services"] as const;
const INCOME_TYPE_CODES = ["business_income", "salary", "other"] as const;
const OFFICE_TYPES = [
  "factory_premises",
  "home_office",
  "owned_office",
  "rented_office",
  "other",
] as const;
const LOCATION_TIERS = ["tier1", "tier2", "tier3"] as const;
const RESIDENCE_TYPES = ["family_owned", "owned", "rented", "other"] as const;
const EMPLOYMENT_STATUS_CODES = ["self_employed", "salaried", "other"] as const;
const ADDITIONAL_PARTY_ROLES = ["co_applicant", "director"] as const;

export interface CollectionFieldError {
  field: string;
  message_i18n_key: string;
}

export interface CollectionValidationResult<T> {
  value?: T;
  errors: CollectionFieldError[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function allowed<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function validLockVersion(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function addError(errors: CollectionFieldError[], field: string): void {
  errors.push({ field, message_i18n_key: `apply.errors.invalid_${field}` });
}

function validRequiredString(value: unknown, min: number, max: number): value is string {
  return typeof value === "string" && value.trim().length >= min && value.trim().length <= max;
}

export function validateBusinessProfile(
  input: unknown,
): CollectionValidationResult<BusinessProfilePayload> {
  if (!isRecord(input)) {
    return {
      errors: [{ field: "body", message_i18n_key: "apply.errors.invalidRequest" }],
    };
  }
  const errors: CollectionFieldError[] = [];
  if (!validRequiredString(input.business_legal_name, 2, 150))
    addError(errors, "business_legal_name");
  if (
    input.trade_name !== undefined &&
    input.trade_name !== null &&
    !validRequiredString(input.trade_name, 1, 150)
  )
    addError(errors, "trade_name");
  if (!allowed(input.business_type_code, BUSINESS_TYPE_CODES))
    addError(errors, "business_type_code");
  if (!allowed(input.income_type_code, INCOME_TYPE_CODES)) addError(errors, "income_type_code");
  if (!allowed(input.type_of_office, OFFICE_TYPES)) addError(errors, "type_of_office");
  if (!allowed(input.location_tier, LOCATION_TIERS)) addError(errors, "location_tier");
  if (!validateBusinessPinCode(input.business_pincode)) addError(errors, "business_pincode");
  if (!allowed(input.annual_turnover_range, TURNOVER_CHOICES))
    addError(errors, "annual_turnover_range");
  if (typeof input.gst_registered !== "boolean") addError(errors, "gst_registered");
  if (!validLockVersion(input.expected_lock_version)) addError(errors, "expected_lock_version");
  if (errors.length > 0) return { errors };

  const value: BusinessProfilePayload = {
    business_legal_name: (input.business_legal_name as string).trim(),
    business_type_code: input.business_type_code as BusinessTypeCode,
    income_type_code: input.income_type_code as IncomeTypeCode,
    type_of_office: input.type_of_office as OfficeType,
    location_tier: input.location_tier as LocationTier,
    business_pincode: input.business_pincode as string,
    annual_turnover_range: input.annual_turnover_range as AnnualTurnoverRange,
    gst_registered: input.gst_registered as boolean,
    expected_lock_version: input.expected_lock_version as number,
  };
  if (typeof input.trade_name === "string") value.trade_name = input.trade_name.trim();
  return { value, errors };
}

export function validateParty(input: unknown): CollectionValidationResult<PartyPayload> {
  if (!isRecord(input)) {
    return { errors: [{ field: "body", message_i18n_key: "apply.errors.invalidRequest" }] };
  }
  const errors: CollectionFieldError[] = [];
  if (!validRequiredString(input.full_name, 2, 150)) addError(errors, "full_name");
  if (!validateMobileNumber(input.mobile_number)) addError(errors, "mobile_number");
  if (!validateEmail(input.email)) addError(errors, "email");
  if (!allowed(input.type_of_residence, RESIDENCE_TYPES)) addError(errors, "type_of_residence");
  if (!allowed(input.employment_status_code, EMPLOYMENT_STATUS_CODES))
    addError(errors, "employment_status_code");
  if (!allowed(input.role, ADDITIONAL_PARTY_ROLES)) addError(errors, "role");
  if (
    input.ownership_pct !== undefined &&
    (typeof input.ownership_pct !== "number" ||
      input.ownership_pct < 0 ||
      input.ownership_pct > 100)
  )
    addError(errors, "ownership_pct");
  if (!validLockVersion(input.expected_lock_version)) addError(errors, "expected_lock_version");
  if (errors.length > 0) return { errors };
  const value: PartyPayload = {
    full_name: (input.full_name as string).trim(),
    mobile_number: input.mobile_number as string,
    email: input.email as string,
    type_of_residence: input.type_of_residence as ResidenceType,
    employment_status_code: input.employment_status_code as EmploymentStatusCode,
    role: input.role as ApplicationPartyRole,
    expected_lock_version: input.expected_lock_version as number,
  };
  if (typeof input.ownership_pct === "number") value.ownership_pct = input.ownership_pct;
  return { value, errors };
}

export function validatePerson(input: unknown): CollectionValidationResult<PersonPayload> {
  if (!isRecord(input)) {
    return { errors: [{ field: "body", message_i18n_key: "apply.errors.invalidRequest" }] };
  }
  const result = validateParty({ ...input, role: "co_applicant" });
  if (!result.value) return result;
  const { role: _role, ownership_pct: _ownershipPct, ...value } = result.value;
  void _role;
  void _ownershipPct;
  return { value, errors: [] };
}

export function validatePartyUpdate(
  input: unknown,
): CollectionValidationResult<PartyUpdatePayload> {
  if (!isRecord(input)) {
    return { errors: [{ field: "body", message_i18n_key: "apply.errors.invalidRequest" }] };
  }
  const result = validateParty({ ...input, role: "co_applicant" });
  if (!result.value) return result;
  const { role: _role, ...value } = result.value;
  void _role;
  return { value, errors: [] };
}

function validateIdentity<T extends PanIdentityPayload | AadhaarIdentityPayload>(
  input: unknown,
  field: "pan_number" | "aadhaar_number",
  validator: (value: unknown) => boolean,
): CollectionValidationResult<T> {
  if (!isRecord(input)) {
    return { errors: [{ field: "body", message_i18n_key: "apply.errors.invalidRequest" }] };
  }
  const errors: CollectionFieldError[] = [];
  if (!validator(input[field])) addError(errors, field);
  if (!validLockVersion(input.expected_lock_version)) addError(errors, "expected_lock_version");
  if (errors.length > 0) return { errors };
  return {
    value: {
      [field]: input[field],
      expected_lock_version: input.expected_lock_version,
    } as unknown as T,
    errors,
  };
}

export function validatePanIdentity(
  input: unknown,
): CollectionValidationResult<PanIdentityPayload> {
  return validateIdentity(input, "pan_number", validatePanNumber);
}

export function validateAadhaarIdentity(
  input: unknown,
): CollectionValidationResult<AadhaarIdentityPayload> {
  return validateIdentity(input, "aadhaar_number", validateAadhaarNumber);
}

export function validateEntityPan(input: unknown): CollectionValidationResult<EntityPanPayload> {
  if (!isRecord(input)) {
    return { errors: [{ field: "body", message_i18n_key: "apply.errors.invalidRequest" }] };
  }
  const errors: CollectionFieldError[] = [];
  if (!validatePanNumber(input.entity_pan)) addError(errors, "entity_pan");
  if (!validLockVersion(input.expected_lock_version)) addError(errors, "expected_lock_version");
  if (errors.length > 0) return { errors };
  return {
    value: {
      entity_pan: input.entity_pan as string,
      expected_lock_version: input.expected_lock_version as number,
    },
    errors,
  };
}

const FACILITY_TYPES = [
  "home",
  "personal",
  "car",
  "education",
  "vehicle",
  "business",
  "gold",
  "credit",
  "other",
] as const;

export function validateCreditDeclaration(
  input: unknown,
): CollectionValidationResult<CreditDeclarationPayload> {
  if (!isRecord(input)) {
    return { errors: [{ field: "body", message_i18n_key: "apply.errors.invalidRequest" }] };
  }
  const errors: CollectionFieldError[] = [];
  if (typeof input.has_active_credit_facilities !== "boolean")
    addError(errors, "has_active_credit_facilities");
  if (
    !Number.isInteger(input.declared_cibil_score) ||
    (input.declared_cibil_score as number) < 300 ||
    (input.declared_cibil_score as number) > 900
  )
    addError(errors, "declared_cibil_score");
  if (!validLockVersion(input.expected_lock_version)) addError(errors, "expected_lock_version");
  if (errors.length > 0) return { errors };
  return {
    value: {
      has_active_credit_facilities: input.has_active_credit_facilities as boolean,
      declared_cibil_score: input.declared_cibil_score as number,
      expected_lock_version: input.expected_lock_version as number,
    },
    errors,
  };
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime());
}

export function validateCreditFacility(
  input: unknown,
): CollectionValidationResult<CreditFacilityPayload> {
  if (!isRecord(input)) {
    return { errors: [{ field: "body", message_i18n_key: "apply.errors.invalidRequest" }] };
  }
  const errors: CollectionFieldError[] = [];
  if (!allowed(input.facility_type, FACILITY_TYPES)) addError(errors, "facility_type");
  if (!validRequiredString(input.lender_name, 1, 150)) addError(errors, "lender_name");
  if (!Number.isInteger(input.original_loan_amount) || (input.original_loan_amount as number) < 0)
    addError(errors, "original_loan_amount");
  if (!Number.isInteger(input.outstanding_amount) || (input.outstanding_amount as number) < 0)
    addError(errors, "outstanding_amount");
  if (!Number.isInteger(input.emi_amount) || (input.emi_amount as number) < 0)
    addError(errors, "emi_amount");
  if (
    typeof input.interest_rate_percent !== "number" ||
    input.interest_rate_percent < 0 ||
    input.interest_rate_percent > 100
  )
    addError(errors, "interest_rate_percent");
  if (!Number.isInteger(input.tenure_months) || (input.tenure_months as number) <= 0)
    addError(errors, "tenure_months");
  if (!validIsoDate(input.start_date)) addError(errors, "start_date");
  if (!validIsoDate(input.end_date)) addError(errors, "end_date");
  if (
    validIsoDate(input.start_date) &&
    validIsoDate(input.end_date) &&
    (input.end_date as string) < (input.start_date as string)
  )
    addError(errors, "end_date");
  if (!Number.isInteger(input.emis_paid_count) || (input.emis_paid_count as number) < 0)
    addError(errors, "emis_paid_count");
  if (!validLockVersion(input.expected_lock_version)) addError(errors, "expected_lock_version");
  if (errors.length > 0) return { errors };
  const value: CreditFacilityPayload = {
    facility_type: input.facility_type as FacilityType,
    lender_name: (input.lender_name as string).trim(),
    original_loan_amount: input.original_loan_amount as number,
    outstanding_amount: input.outstanding_amount as number,
    emi_amount: input.emi_amount as number,
    interest_rate_percent: input.interest_rate_percent as number,
    tenure_months: input.tenure_months as number,
    start_date: input.start_date as string,
    end_date: input.end_date as string,
    emis_paid_count: input.emis_paid_count as number,
    expected_lock_version: input.expected_lock_version as number,
  };
  if (typeof input.is_closed === "boolean") value.is_closed = input.is_closed;
  return { value, errors };
}

export function validateConsentGrants(
  input: unknown,
): CollectionValidationResult<ConsentGrantPayload> {
  if (!isRecord(input)) {
    return { errors: [{ field: "body", message_i18n_key: "apply.errors.invalidRequest" }] };
  }
  const errors: CollectionFieldError[] = [];
  if (!isRecord(input.grants)) {
    addError(errors, "grants");
  } else if (
    !Object.values(input.grants).every((value) => typeof value === "boolean") ||
    Object.keys(input.grants).length === 0
  ) {
    addError(errors, "grants");
  }
  if (!validLockVersion(input.expected_lock_version)) addError(errors, "expected_lock_version");
  if (errors.length > 0) return { errors };
  return {
    value: {
      grants: input.grants as Record<string, boolean>,
      expected_lock_version: input.expected_lock_version as number,
    },
    errors,
  };
}

export function validateSubmitApplication(
  input: unknown,
): CollectionValidationResult<SubmitApplicationPayload> {
  if (!isRecord(input)) {
    return { errors: [{ field: "body", message_i18n_key: "apply.errors.invalidRequest" }] };
  }
  const errors: CollectionFieldError[] = [];
  if (!validLockVersion(input.expected_lock_version)) addError(errors, "expected_lock_version");
  if (errors.length > 0) return { errors };
  return {
    value: { expected_lock_version: input.expected_lock_version as number },
    errors,
  };
}

export function validateGstRegistration(
  input: unknown,
): CollectionValidationResult<GstRegistrationPayload> {
  if (!isRecord(input)) {
    return { errors: [{ field: "body", message_i18n_key: "apply.errors.invalidRequest" }] };
  }
  const errors: CollectionFieldError[] = [];
  if (typeof input.gst_registered !== "boolean") addError(errors, "gst_registered");
  if (typeof input.gst_consent !== "boolean") addError(errors, "gst_consent");
  if (!validLockVersion(input.expected_lock_version)) addError(errors, "expected_lock_version");
  if (input.gst_registered === true) {
    if (input.gst_consent === false) addError(errors, "gst_consent");
    if (
      typeof input.state_code !== "string" ||
      !/^(0[1-9]|[12][0-9]|3[0-8])$/.test(input.state_code)
    )
      addError(errors, "state_code");
    if (
      typeof input.gstin !== "string" ||
      input.gstin.trim() === "" ||
      !validateGstin(input.gstin)
    )
      addError(errors, "gstin");
    if (
      typeof input.state_code === "string" &&
      typeof input.gstin === "string" &&
      input.gstin.slice(0, 2) !== input.state_code
    )
      addError(errors, "state_code");
  } else if (input.gst_registered === false) {
    if (input.gst_consent === true) addError(errors, "gst_consent");
    if (
      (input.state_code !== undefined && input.state_code !== null) ||
      (input.gstin !== undefined && input.gstin !== null)
    ) {
      addError(errors, "gst_registered");
    }
  }
  if (errors.length > 0) return { errors };
  const value: GstRegistrationPayload = {
    gst_registered: input.gst_registered as boolean,
    gst_consent: input.gst_consent as boolean,
    expected_lock_version: input.expected_lock_version as number,
  };
  if (typeof input.state_code === "string") value.state_code = input.state_code;
  if (typeof input.gstin === "string") value.gstin = input.gstin;
  return { value, errors };
}
