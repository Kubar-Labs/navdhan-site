"use client";

import { StepDefinition } from "./types";

export const STEP_ORDER: StepDefinition[] = [
  { id: "loan_intent", title: "Loan intent", description: "Tell us what you need the loan for." },
  { id: "personal_contact", title: "Personal contact", description: "Share your contact details." },
  {
    id: "aadhaar_verification",
    title: "Aadhaar verification",
    description: "Verify your identity with Aadhaar OTP.",
  },
  { id: "pan_verification", title: "PAN verification", description: "Confirm your PAN for KYC." },
  {
    id: "gst_verification",
    title: "GST verification",
    description: "Add your GSTIN or skip if not registered.",
  },
  { id: "itr_upload", title: "ITR upload", description: "Upload your latest ITR PDF." },
  {
    id: "bank_statements",
    title: "Bank statements",
    description: "Link your bank statements securely.",
  },
  {
    id: "review_submit",
    title: "Review & submit",
    description: "Review your application and give consent.",
  },
  { id: "submission_result", title: "Submission result", description: "Your application status." },
];

export const PURPOSE_LABELS: Record<string, string> = {
  working_capital: "Working capital",
  machinery: "Machinery / Equipment",
  inventory: "Inventory purchase",
  business_expansion: "Business expansion",
  debt_refinancing: "Debt refinancing",
  other: "Other business need",
};

export const ITR_ALLOWED_TYPES = ["application/pdf"];

export const ITR_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export const CSRF_HEADER = "x-navdhan-requested-with";
export const CSRF_HEADER_VALUE = "apply";

export const STORAGE_KEY = "navdhan-apply-draft";
