/**
 * Shared types for the /apply loan application portal.
 *
 * Source of truth: .opencode/factory/apply-contract.yaml v1.1.0
 */

export const APPLICATION_STEPS = [
  "loan_intent",
  "personal_contact",
  "aadhaar_verification",
  "pan_verification",
  "gst_verification",
  "itr_upload",
  "bank_statements",
  "review_submit",
  "submission_result",
] as const;

export type ApplicationStep = (typeof APPLICATION_STEPS)[number];

export type ApplicationStatus = "draft" | "submitted" | "declined" | "expired";

export type LoanPurpose =
  | "working_capital"
  | "machinery"
  | "inventory"
  | "business_expansion"
  | "debt_refinancing"
  | "other";

export type DocumentType = "itr" | "tds_certificate" | "bank_statement" | "gst_return" | "other";
export type DocumentStatus = "pending" | "uploaded" | "scanned" | "failed";
export type ScanResult = "clean" | "infected" | "unreadable";
export type PerfiosStatus = "pending" | "success" | "failure" | "partial";
export type OfferStatus = "eligible" | "selected" | "expired" | "rejected";

export type ConsentStep =
  | "aadhaar_verification"
  | "itr_upload"
  | "bank_statements"
  | "review_submit";

export const SUPPORTED_LOCALES = ["en", "hi", "bn", "te", "mr", "ta", "kn", "ml"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export interface ApplicationRecord {
  id: string;
  sessionId: string;
  status: ApplicationStatus;
  currentStep: ApplicationStep;
  referenceNumber: string | null;
  loanAmount: string | null;
  tenureMonths: number | null;
  purpose: LoanPurpose | null;
  referralCode: string | null;
  gstinSkipped: boolean;
  perfiosTransactionId: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  expiresAt: string;
}

export interface ApplicantRecord {
  applicationId: string;
  fullName: string | null;
  mobileNumber: string | null;
  email: string | null;
  businessPinCode: string | null;
  aadhaarNumber: string | null;
  aadhaarVerified: boolean;
  aadhaarVerifiedAt: string | null;
  panNumber: string | null;
  panVerified: boolean;
  panVerifiedAt: string | null;
  gstin: string | null;
}

export interface DocumentRecord {
  id: string;
  applicationId: string;
  documentType: DocumentType;
  fileName: string;
  mimeType: string;
  storagePath: string;
  fileSizeBytes: number;
  status: DocumentStatus;
  scanResult: ScanResult | null;
  financialYear: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConsentRecord {
  consentId: string;
  applicationId: string;
  stepId: string;
  consentKey: string;
  accepted: boolean;
  statementSnapshot: string;
  locale: string;
  clientIpHash: string;
  userAgentHash: string | null;
  recordedAt: string;
}

export interface PerfiosTransaction {
  perfiosTransactionId: string;
  applicationId: string;
  status: PerfiosStatus;
  statementCount: number | null;
  monthCount: number | null;
  failureReason: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface OtpAttempt {
  otpReferenceId: string;
  applicationId: string;
  channel: "sms" | "aadhaar";
  destinationHash: string;
  purpose: "aadhaar_verification" | "mobile_verification";
  expiresAt: string;
  verified: boolean;
  attemptCount: number;
}

export interface LenderOfferRecord {
  offerId: string;
  applicationId: string;
  lenderName: string;
  lenderLogoUrl: string | null;
  loanAmount: number;
  interestRateAnnual: number;
  tenureMonths: number;
  emiAmount: number;
  totalInterest: number;
  processingFee: number;
  netDisbursal: number;
  status: OfferStatus;
  expiresAt: string | null;
  createdAt: string;
}
