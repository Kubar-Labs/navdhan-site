/**
 * In-memory store for the apply backend MVP / test harness.
 *
 * Mirrors the tables from src/db/schema.ts. Production should replace this
 * with a PostgreSQL-backed repository.
 */

import { randomUUID } from "crypto";
import {
  type ApplicationRecord,
  type ApplicantRecord,
  type ConsentRecord,
  type DocumentRecord,
  type LenderOfferRecord,
  type OtpAttempt,
  type PerfiosTransaction,
  type ApplicationStatus,
  type ApplicationStep,
} from "@/src/types/apply";

export const applicationsById = new Map<string, ApplicationRecord>();
export const applicationsBySession = new Map<string, ApplicationRecord>();
export const applicantsByApplicationId = new Map<string, ApplicantRecord>();
export const documentsById = new Map<string, DocumentRecord>();
export const consentsByApplicationId = new Map<string, ConsentRecord[]>();
export const perfiosTransactions = new Map<string, PerfiosTransaction>();
export const otpAttemptsByReference = new Map<string, OtpAttempt>();
export const offersByApplicationId = new Map<string, LenderOfferRecord[]>();

export const SESSION_TTL_MINUTES = 30;

export function nowIso(): string {
  return new Date().toISOString();
}

export function expiryFromNow(minutes = SESSION_TTL_MINUTES): string {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

export function createApplication(
  sessionId: string,
  applicationId?: string,
): ApplicationRecord {
  const id = applicationId && applicationId.match(/^[0-9a-f-]{36}$/i)
    ? applicationId
    : randomUUID();
  const now = nowIso();
  const app: ApplicationRecord = {
    id,
    sessionId,
    status: "draft",
    currentStep: "loan_intent",
    referenceNumber: null,
    loanAmount: null,
    tenureMonths: null,
    purpose: null,
    referralCode: null,
    gstinSkipped: false,
    perfiosTransactionId: null,
    submittedAt: null,
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
    expiresAt: expiryFromNow(),
  };
  applicationsById.set(id, app);
  applicationsBySession.set(sessionId, app);
  applicantsByApplicationId.set(id, createApplicant(id));
  consentsByApplicationId.set(id, []);
  offersByApplicationId.set(id, []);
  return app;
}

export function createApplicant(applicationId: string): ApplicantRecord {
  return {
    applicationId,
    fullName: null,
    mobileNumber: null,
    email: null,
    businessPinCode: null,
    aadhaarNumber: null,
    aadhaarVerified: false,
    aadhaarVerifiedAt: null,
    panNumber: null,
    panVerified: false,
    panVerifiedAt: null,
    gstin: null,
  };
}

export function getOrCreateApplication(
  sessionId: string,
  applicationId?: string,
): ApplicationRecord {
  if (applicationId) {
    const existing = applicationsById.get(applicationId);
    if (existing) {
      existing.sessionId = sessionId;
      applicationsBySession.set(sessionId, existing);
      return touchApplication(existing);
    }
    return touchApplication(createApplication(sessionId, applicationId));
  }
  const existing = applicationsBySession.get(sessionId);
  if (existing) {
    return touchApplication(existing);
  }
  return createApplication(sessionId);
}

export function touchApplication(app: ApplicationRecord): ApplicationRecord {
  const now = nowIso();
  app.updatedAt = now;
  app.lastActivityAt = now;
  app.expiresAt = expiryFromNow();
  applicationsBySession.set(app.sessionId, app);
  return app;
}

export function getApplicationById(
  id: string,
): ApplicationRecord | undefined {
  return applicationsById.get(id);
}

export function getApplicant(applicationId: string): ApplicantRecord {
  let applicant = applicantsByApplicationId.get(applicationId);
  if (!applicant) {
    applicant = createApplicant(applicationId);
    applicantsByApplicationId.set(applicationId, applicant);
  }
  return applicant;
}

export function addDocument(doc: DocumentRecord): void {
  documentsById.set(doc.id, doc);
}

export function getDocumentsByApplicationId(
  applicationId: string,
): DocumentRecord[] {
  return Array.from(documentsById.values()).filter(
    (d) => d.applicationId === applicationId,
  );
}

export function addConsent(consent: ConsentRecord): void {
  const list = consentsByApplicationId.get(consent.applicationId) ?? [];
  list.push(consent);
  consentsByApplicationId.set(consent.applicationId, list);
}

export function getConsentsByApplicationId(
  applicationId: string,
): ConsentRecord[] {
  return consentsByApplicationId.get(applicationId) ?? [];
}

export function addPerfiosTransaction(txn: PerfiosTransaction): void {
  perfiosTransactions.set(txn.perfiosTransactionId, txn);
}

export function getPerfiosTransaction(
  id: string,
): PerfiosTransaction | undefined {
  return perfiosTransactions.get(id);
}

export function setOffers(
  applicationId: string,
  offers: LenderOfferRecord[],
): void {
  offersByApplicationId.set(applicationId, offers);
}

export function getOffersByApplicationId(
  applicationId: string,
): LenderOfferRecord[] {
  return offersByApplicationId.get(applicationId) ?? [];
}

export function addOtpAttempt(attempt: OtpAttempt): void {
  otpAttemptsByReference.set(attempt.otpReferenceId, attempt);
}

export function getOtpAttempt(id: string): OtpAttempt | undefined {
  return otpAttemptsByReference.get(id);
}
