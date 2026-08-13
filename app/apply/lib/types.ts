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

export type WizardStatus = "idle" | "loading" | "saving" | "submitting" | "submitted" | "error";

export type VerificationStatus = "idle" | "requesting" | "verifying" | "verified" | "error";

export type DocumentUploadStatus = "empty" | "selected" | "uploading" | "uploaded" | "error";

export type BankLinkStatus = "idle" | "linking" | "linked" | "error";

export interface DocumentRef {
  name: string;
  type: string;
  size: number;
  url?: string;
  error?: string;
}

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
  aadhaar_number?: string;
  party_aadhaar_numbers?: Record<string, string>;
  aadhaar_consent?: boolean;
  aadhaar_otp?: string;
  aadhaar_status?: VerificationStatus;
  pan_number?: string;
  party_pan_numbers?: Record<string, string>;
  entity_pan?: string;
  pan_consent?: boolean;
  gst_registered?: boolean;
  gstin?: string;
  gst_consent?: boolean;
  annual_turnover?: string;
  itr_document?: DocumentRef;
  itr_consent?: boolean;
  bank_linked?: boolean;
  bank_consent?: boolean;
  privacy_consent?: boolean;
  terms_consent?: boolean;
  credit_consent?: boolean;
  communication_consent?: boolean;
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

export interface SubmissionResultValues {
  application_reference: string;
  status: "success" | "failure";
  message?: string;
  offers_available?: boolean;
}

export interface OfferSummary {
  id: string;
  lender: string;
  amount: number;
  tenure_months: number;
  interest_rate_annual: number;
  emi: number;
  processing_fee: number;
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
