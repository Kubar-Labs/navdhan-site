"use client";

import type { Purpose } from "./validation";

export type WizardStepId =
  | "loan_intent"
  | "personal_contact"
  | "aadhaar_verification"
  | "pan_verification"
  | "gst_verification"
  | "itr_upload"
  | "bank_statements"
  | "review_submit"
  | "submission_result";

export interface ApplyFormValues {
  constitution?: Constitution;
  loan_amount?: number;
  tenure_months?: number;
  purpose?: Purpose | string;
  referral_code?: string;
  full_name?: string;
  mobile_number?: string;
  email?: string;
  business_pin_code?: string;
  business_legal_name?: string;
  trade_name?: string;
  business_type_code?: BusinessTypeCode;
  income_type_code?: IncomeTypeCode;
  type_of_office?: OfficeType;
  location_tier?: LocationTier;
  type_of_residence?: ResidenceType;
  employment_status_code?: EmploymentStatusCode;
  additional_party_full_name?: string;
  additional_party_mobile_number?: string;
  additional_party_email?: string;
  additional_party_type_of_residence?: ResidenceType;
  additional_party_employment_status_code?: EmploymentStatusCode;
  additional_party_ownership_pct?: number;
  party_aadhaar_numbers?: Record<string, string>;
  confirm_party_aadhaar_numbers?: Record<string, string>;
  aadhaar_consent?: boolean;
  party_pan_numbers?: Record<string, string>;
  confirm_party_pan_numbers?: Record<string, string>;
  entity_pan?: string;
  confirm_entity_pan?: string;
  pan_consent?: boolean;
  gst_registered?: boolean;
  gstin?: string;
  confirm_gstin?: string;
  gst_consent?: boolean;
  annual_turnover?: string;
  application_reference?: string;
}

export interface StepDefinition {
  id: WizardStepId;
  title: string;
  description?: string;
}

export interface WizardErrors {
  [field: string]: string | undefined;
}

export type BusinessTypeCode = "trading" | "manufacturing" | "services";
export type Constitution = "proprietorship" | "partnership" | "private_limited";
export type IncomeTypeCode = "business_income" | "salary" | "other";
export type OfficeType =
  "factory_premises" | "home_office" | "owned_office" | "rented_office" | "other";
export type LocationTier = "tier1" | "tier2" | "tier3";
export type ResidenceType = "family_owned" | "owned" | "rented" | "other";
export type EmploymentStatusCode = "self_employed" | "salaried" | "other";
export type AnnualTurnoverRange = "0_10" | "10_50" | "50_100" | "100_500" | "500_plus";
export type ApplicationPartyRole = "co_applicant" | "director";

export interface VersionedCollectionWrite {
  expected_lock_version: number;
}

export interface LoanIntentPayload extends VersionedCollectionWrite {
  constitution: Constitution;
  requested_amount: number;
  requested_tenure_months: number;
  purpose: Purpose;
  referral_code?: string;
}

export interface ApplySessionResponse {
  session_id: string;
  expires_at: string;
}

export interface BusinessProfilePayload extends VersionedCollectionWrite {
  business_legal_name: string;
  trade_name?: string;
  business_type_code: BusinessTypeCode;
  income_type_code: IncomeTypeCode;
  type_of_office: OfficeType;
  location_tier: LocationTier;
  business_pincode: string;
  annual_turnover_range: AnnualTurnoverRange;
  gst_registered: boolean;
}

export interface PartyPayload extends VersionedCollectionWrite {
  full_name: string;
  mobile_number: string;
  email: string;
  type_of_residence: ResidenceType;
  employment_status_code: EmploymentStatusCode;
  role: ApplicationPartyRole;
  ownership_pct?: number;
}

export type PersonPayload = Omit<PartyPayload, "role" | "ownership_pct">;
export interface PartyUpdatePayload extends PersonPayload {
  ownership_pct?: number;
}

export interface PanIdentityPayload extends VersionedCollectionWrite {
  pan_number: string;
}

export interface AadhaarIdentityPayload extends VersionedCollectionWrite {
  aadhaar_number: string;
}

export interface EntityPanPayload extends VersionedCollectionWrite {
  entity_pan: string;
}

export interface GstRegistrationPayload extends VersionedCollectionWrite {
  gst_registered: boolean;
  gst_consent: boolean;
  state_code?: string;
  gstin?: string;
}

export interface CollectionWriteResponse {
  application_id: string;
  application_no: string;
  status: string;
  current_step: string;
  checklist_version_id: string;
  requirements_count: number;
  lock_version: number;
  values: {
    constitution: Constitution;
    requested_amount: number;
    requested_tenure_months: number;
    purpose: Purpose;
    referral_code: string | null;
  };
  business_profile: {
    business_legal_name: string | null;
    trade_name: string | null;
    business_type_code: BusinessTypeCode | null;
    income_type_code: IncomeTypeCode | null;
    type_of_office: OfficeType | null;
    location_tier: LocationTier | null;
    business_pincode: string | null;
    annual_turnover_range: AnnualTurnoverRange | null;
    gst_registered: boolean | null;
  };
  parties: Array<{
    party_id: string;
    role: string;
    is_primary: boolean;
    ownership_pct: number | null;
    full_name: string | null;
    mobile_masked: string | null;
    email_masked: string | null;
    type_of_residence: ResidenceType | null;
    employment_status_code: EmploymentStatusCode | null;
    identifiers: {
      pan_masked: string | null;
      aadhaar_masked: string | null;
    };
  }>;
  registrations: {
    entity_pan_masked: string | null;
    gstin_masked: string | null;
    gst_state_code: string | null;
  };
}

export type FacilityType =
  "home" | "personal" | "car" | "education" | "vehicle" | "business" | "gold" | "credit" | "other";

export interface CreditDeclarationPayload extends VersionedCollectionWrite {
  has_active_credit_facilities: boolean;
  declared_cibil_score: number;
}

export interface CreditFacilityPayload extends VersionedCollectionWrite {
  facility_type: FacilityType;
  lender_name: string;
  original_loan_amount: number;
  outstanding_amount: number;
  emi_amount: number;
  interest_rate_percent: number;
  tenure_months: number;
  start_date: string;
  end_date: string;
  emis_paid_count: number;
  is_closed?: boolean;
}

export interface RequirementDocument {
  document_id: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string | null;
  coverage_from: string | null;
  coverage_to: string | null;
  status:
    | "uploading"
    | "quarantined"
    | "uploaded"
    | "scan_failed"
    | "superseded"
    | "purged";
  scan_result: "pending" | "clean" | "infected" | "unreadable";
}

export type RequirementStatus =
  | "pending"
  | "partial"
  | "collected"
  | "accepted_for_review"
  | "rejected"
  | "waived"
  | "not_applicable"
  | "missing";

export interface RequirementRow {
  application_requirement_id: string;
  document_type_code: string;
  display_name: string;
  category: string | null;
  attaches_to: "entity" | "person" | "facility" | "document" | "registration";
  application_party_id: string | null;
  // Person-attached requirements repeat per party, so the row needs to say
  // whose document it is. Optional: a frontend can transiently run against a
  // backend that predates these fields.
  party_role?: string | null;
  party_name?: string | null;
  party_is_primary?: boolean | null;
  facility_id: string | null;
  obligation: "mandatory" | "optional" | "conditional";
  blocks_submission: boolean;
  alt_group: string | null;
  coverage_mode: "none" | "month_range" | "fiscal_year" | "per_facility";
  min_count: number;
  required_period_from: string | null;
  required_period_to: string | null;
  fiscal_year_start: string | null;
  status: RequirementStatus;
  documents: RequirementDocument[];
}

export interface FacilityRow {
  facility_id: string;
  facility_type: FacilityType;
  lender_name: string;
  original_loan_amount: number | null;
  outstanding_amount: number | null;
  emi_amount: number | null;
  interest_rate_percent: number | null;
  tenure_months: number | null;
  start_date: string | null;
  end_date: string | null;
  emis_paid_count: number | null;
  is_closed: boolean;
}

export interface RequirementsResponse {
  application_id: string;
  lock_version: number;
  credit_declaration: {
    has_active_credit_facilities: boolean | null;
    declared_cibil_score: number | null;
  };
  facilities: FacilityRow[];
  requirements: RequirementRow[];
}

export interface ConsentPurposeRow {
  purpose_code: string;
  display_name: string;
  notice_text: string;
  notice_version: number;
  is_mandatory: boolean;
  granted: boolean;
}

export interface ConsentStatusResponse {
  application_id: string;
  lock_version: number;
  purposes: ConsentPurposeRow[];
}

export interface ConsentGrantPayload extends VersionedCollectionWrite {
  grants: Record<string, boolean>;
}

export type SubmitApplicationPayload = VersionedCollectionWrite;

export interface SubmitApplicationResponse {
  application_id: string;
  application_no: string;
  status: string;
  submitted_at: string | null;
  lock_version: number;
}

export function isWizardStepId(value: unknown): value is WizardStepId {
  const ids: WizardStepId[] = [
    "loan_intent",
    "personal_contact",
    "aadhaar_verification",
    "pan_verification",
    "gst_verification",
    "itr_upload",
    "bank_statements",
    "review_submit",
    "submission_result",
  ];
  return typeof value === "string" && ids.includes(value as WizardStepId);
}
