"use client";

import { Purpose } from "./validation";

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
  loan_amount?: number;
  tenure_months?: number;
  purpose?: Purpose | string;
  referral_code?: string;
  full_name?: string;
  mobile_number?: string;
  email?: string;
  business_pin_code?: string;
  aadhaar_number?: string;
  aadhaar_consent?: boolean;
  aadhaar_otp?: string;
  aadhaar_status?: VerificationStatus;
  pan_number?: string;
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
