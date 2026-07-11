/**
 * Apply portal PostgreSQL schema.
 *
 * Source of truth: .opencode/factory/db-schema.yaml v1.1.0
 *
 * All monetary amounts use DECIMAL(19,4). PII columns are marked in comments;
 * encryption is implemented in the service layer for v1.
 */

import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  decimal,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const applicationStatusEnum = pgEnum("application_status", [
  "draft",
  "submitted",
  "declined",
  "expired",
]);

export const applicationStepEnum = pgEnum("application_step", [
  "loan_intent",
  "personal_contact",
  "aadhaar_verification",
  "pan_verification",
  "gst_verification",
  "itr_upload",
  "bank_statements",
  "review_submit",
  "submission_result",
]);

export const loanPurposeEnum = pgEnum("loan_purpose", [
  "working_capital",
  "machinery",
  "inventory",
  "business_expansion",
  "debt_refinancing",
  "other",
]);

export const documentTypeEnum = pgEnum("document_type", [
  "itr",
  "bank_statement",
  "gst_return",
  "other",
]);

export const documentStatusEnum = pgEnum("document_status", [
  "pending",
  "uploaded",
  "scanned",
  "failed",
]);

export const scanResultEnum = pgEnum("scan_result", ["clean", "infected", "unreadable"]);

export const perfiosStatusEnum = pgEnum("perfios_status", [
  "pending",
  "success",
  "failure",
  "partial",
]);

export const bankStatementStatusEnum = pgEnum("bank_statement_status", [
  "pending",
  "success",
  "failure",
  "partial",
]);

export const consentStepEnum = pgEnum("consent_step", [
  "aadhaar_verification",
  "itr_upload",
  "bank_statements",
  "review_submit",
]);

export const offerStatusEnum = pgEnum("offer_status", [
  "eligible",
  "selected",
  "expired",
  "rejected",
]);

export const teamLocalizationKindEnum = pgEnum("team_localization_kind", ["member", "advisor"]);

export const teamLocalizationFieldEnum = pgEnum("team_localization_field", [
  "role",
  "bio",
  "domain",
  "contribution",
]);

export const eventTypeEnum = pgEnum("event_type", [
  "draft_created",
  "step_transition",
  "otp_sent",
  "otp_verified",
  "otp_failed",
  "consent_recorded",
  "document_uploaded",
  "document_scan_completed",
  "perfios_initiated",
  "perfios_callback_received",
  "application_submitted",
  "submission_failed",
  "offer_received",
  "offer_selected",
]);

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: varchar("session_id", { length: 255 }).notNull(),
    referenceNumber: varchar("reference_number", { length: 32 }),
    status: applicationStatusEnum("status").notNull().default("draft"),
    currentStep: applicationStepEnum("current_step").notNull().default("loan_intent"),
    loanAmount: decimal("loan_amount", { precision: 19, scale: 4 }),
    tenureMonths: smallint("tenure_months"),
    purpose: loanPurposeEnum("purpose"),
    referralCode: varchar("referral_code", { length: 20 }),
    gstinSkipped: boolean("gstin_skipped").notNull().default(false),
    perfiosTransactionId: varchar("perfios_transaction_id", {
      length: 255,
    }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sessionIdx: index("idx_applications_session_id").on(table.sessionId),
    referenceNumberIdx: uniqueIndex("idx_applications_reference_number").on(table.referenceNumber),
    statusCreatedIdx: index("idx_applications_status_created").on(table.status, table.createdAt),
    chkLoanAmount: check(
      "chk_applications_loan_amount",
      sql.raw(
        "loan_amount IS NULL OR (loan_amount BETWEEN 500000.0000 AND 10000000.0000 AND loan_amount % 10000 = 0)",
      ),
    ),
    chkTenure: check(
      "chk_applications_tenure",
      sql`${table.tenureMonths} IS NULL OR ${table.tenureMonths} BETWEEN 3 AND 12`,
    ),
    chkReferral: check(
      "chk_applications_referral",
      sql.raw("referral_code IS NULL OR referral_code ~ '^[A-Za-z0-9_-]+$'"),
    ),
  }),
);

export const applicants = pgTable(
  "applicants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    piiKeyId: varchar("pii_key_id", { length: 255 }).notNull().default("v1"),
    fullName: text("full_name"), // PII — encrypted at rest.
    mobileNumberHash: varchar("mobile_number_hash", { length: 64 }),
    mobileNumberEncrypted: text("mobile_number_encrypted"), // PII — encrypted at rest.
    mobileNumberLastFour: varchar("mobile_number_last_four", { length: 4 }),
    emailHash: varchar("email_hash", { length: 64 }),
    emailEncrypted: text("email_encrypted"), // PII — encrypted at rest.
    businessPinCode: varchar("business_pin_code", { length: 6 }),
    aadhaarHash: varchar("aadhaar_hash", { length: 64 }), // One-way hash for lookup/deduplication.
    aadhaarLastFour: varchar("aadhaar_last_four", { length: 4 }),
    aadhaarVerified: boolean("aadhaar_verified").notNull().default(false),
    aadhaarVerifiedAt: timestamp("aadhaar_verified_at", {
      withTimezone: true,
    }),
    panHash: varchar("pan_hash", { length: 64 }), // One-way hash for lookup/deduplication.
    panEncrypted: text("pan_encrypted"), // PII — encrypted at rest.
    panMasked: varchar("pan_masked", { length: 10 }),
    panVerified: boolean("pan_verified").notNull().default(false),
    panVerifiedAt: timestamp("pan_verified_at", { withTimezone: true }),
    gstin: varchar("gstin", { length: 15 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    applicationIdx: uniqueIndex("idx_applicants_application_id").on(table.applicationId),
    mobileHashIdx: index("idx_applicants_mobile_hash").on(table.mobileNumberHash),
    emailHashIdx: index("idx_applicants_email_hash").on(table.emailHash),
    aadhaarHashIdx: index("idx_applicants_aadhaar_hash").on(table.aadhaarHash),
    panHashIdx: index("idx_applicants_pan_hash").on(table.panHash),
    gstinIdx: index("idx_applicants_gstin").on(table.gstin),
    chkBusinessPinCode: check(
      "chk_applicants_business_pin_code",
      sql.raw("business_pin_code IS NULL OR business_pin_code ~ '^[1-9][0-9]{5}$'"),
    ),
    chkGstin: check(
      "chk_applicants_gstin",
      sql.raw("gstin IS NULL OR gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'"),
    ),
  }),
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    documentType: documentTypeEnum("document_type").notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 127 }).notNull(),
    storagePath: text("storage_path").notNull(), // Internal object-store path; not returned to clients.
    encryptionKeyId: varchar("encryption_key_id", { length: 255 }).notNull(),
    fileSizeBytes: bigint("file_size_bytes", { mode: "number" }).notNull(),
    status: documentStatusEnum("status").notNull().default("pending"),
    scanResult: scanResultEnum("scan_result"),
    financialYear: varchar("financial_year", { length: 7 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    applicationIdx: index("idx_documents_application_id").on(table.applicationId),
    applicationTypeIdx: index("idx_documents_application_type").on(
      table.applicationId,
      table.documentType,
    ),
    statusIdx: index("idx_documents_status").on(table.status, table.updatedAt),
    chkMimeType: check("chk_documents_mime_type", sql.raw("mime_type = 'application/pdf'")),
    chkFileSize: check(
      "chk_documents_file_size",
      sql.raw("file_size_bytes > 0 AND file_size_bytes <= 5242880"),
    ),
  }),
);

export const consents = pgTable(
  "consents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    stepId: consentStepEnum("step_id").notNull(),
    consentKey: varchar("consent_key", { length: 127 }).notNull(),
    accepted: boolean("accepted").notNull(),
    statementSnapshot: text("statement_snapshot").notNull(),
    locale: varchar("locale", { length: 5 }).notNull(),
    clientIpHash: varchar("client_ip_hash", { length: 64 }).notNull(),
    userAgentHash: varchar("user_agent_hash", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    applicationKeyIdx: index("idx_consents_application_key").on(
      table.applicationId,
      table.consentKey,
    ),
    applicationStepIdx: index("idx_consents_application_step").on(
      table.applicationId,
      table.stepId,
    ),
    createdIdx: index("idx_consents_created").on(table.createdAt),
  }),
);

export const lenderOffers = pgTable(
  "lender_offers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    lenderName: varchar("lender_name", { length: 127 }).notNull(),
    lenderLogoUrl: text("lender_logo_url"),
    loanAmount: decimal("loan_amount", { precision: 19, scale: 4 }).notNull(),
    interestRateAnnual: decimal("interest_rate_annual", {
      precision: 5,
      scale: 2,
    }).notNull(),
    tenureMonths: smallint("tenure_months").notNull(),
    emiAmount: decimal("emi_amount", { precision: 19, scale: 4 }).notNull(),
    totalInterest: decimal("total_interest", {
      precision: 19,
      scale: 4,
    }).notNull(),
    processingFee: decimal("processing_fee", { precision: 19, scale: 4 })
      .notNull()
      .default("0.0000"),
    netDisbursal: decimal("net_disbursal", {
      precision: 19,
      scale: 4,
    }).notNull(),
    status: offerStatusEnum("status").notNull().default("eligible"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    selectedAt: timestamp("selected_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    applicationIdx: index("idx_lender_offers_application_id").on(table.applicationId),
    statusIdx: index("idx_lender_offers_status").on(table.status, table.expiresAt),
    applicationStatusUnique: uniqueIndex("idx_lender_offers_application_status")
      .on(table.applicationId, table.status)
      .where(sql`${table.status} = 'selected'`),
    chkLoanAmount: check("chk_lender_offers_loan_amount", sql`${table.loanAmount} > 0`),
    chkInterestRate: check("chk_lender_offers_interest_rate", sql`${table.interestRateAnnual} > 0`),
    chkTenure: check("chk_lender_offers_tenure", sql`${table.tenureMonths} BETWEEN 3 AND 12`),
  }),
);

export const applicationEvents = pgTable(
  "application_events",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    eventType: eventTypeEnum("event_type").notNull(),
    stepId: applicationStepEnum("step_id"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    applicationIdx: index("idx_application_events_application_id").on(
      table.applicationId,
      table.createdAt,
    ),
    typeIdx: index("idx_application_events_type").on(table.eventType, table.createdAt),
  }),
);

export const otpAttempts = pgTable(
  "otp_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    channel: varchar("channel", { length: 16 }).notNull(),
    destinationHash: varchar("destination_hash", { length: 64 }).notNull(),
    otpReferenceId: varchar("otp_reference_id", { length: 64 }).notNull().unique(),
    purpose: varchar("purpose", { length: 32 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    verified: boolean("verified").notNull().default(false),
    attemptCount: smallint("attempt_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    referenceIdx: uniqueIndex("idx_otp_attempts_reference").on(table.otpReferenceId),
    destinationIdx: index("idx_otp_attempts_destination").on(
      table.destinationHash,
      table.createdAt,
    ),
    applicationIdx: index("idx_otp_attempts_application").on(table.applicationId, table.createdAt),
    chkChannel: check("chk_otp_attempts_channel", sql`${table.channel} IN ('sms', 'aadhaar')`),
    chkAttemptCount: check(
      "chk_otp_attempts_attempt_count",
      sql`${table.attemptCount} >= 0 AND ${table.attemptCount} <= 3`,
    ),
  }),
);

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    keyHash: varchar("key_hash", { length: 64 }).notNull(),
    scope: varchar("scope", { length: 255 }).notNull(),
    requestPath: varchar("request_path", { length: 255 }).notNull(),
    payloadHash: varchar("payload_hash", { length: 64 }).notNull(),
    responseStatus: smallint("response_status").notNull(),
    responseBody: jsonb("response_body"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    lookupIdx: uniqueIndex("idx_idempotency_keys_lookup")
      .on(table.keyHash, table.scope)
      .where(sql`${table.expiresAt} > now()`),
    expiresIdx: index("idx_idempotency_keys_expires").on(table.expiresAt),
  }),
);

/**
 * Perfios bank-statement analysis records.
 *
 * Canonical name in db-schema.yaml / approved CDD is `bank_statements`
 * (the previous working name was `perfios_sessions`).
 */
export const bankStatements = pgTable(
  "bank_statements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    bankName: varchar("bank_name", { length: 127 }),
    accountNumberEncrypted: text("account_number_encrypted"), // PII — encrypted at rest.
    accountNumberLastFour: varchar("account_number_last_four", { length: 4 }),
    perfiosTransactionId: varchar("perfios_transaction_id", { length: 255 }),
    months: smallint("months"),
    status: bankStatementStatusEnum("status").notNull().default("pending"),
    analysisScore: numeric("analysis_score", { precision: 5, scale: 2 }),
    analyzedAt: timestamp("analyzed_at", { withTimezone: true }),
    rawPayload: jsonb("raw_payload").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    applicationIdx: index("idx_bank_statements_application_id").on(table.applicationId),
    perfiosTxIdx: index("idx_bank_statements_perfios_transaction_id").on(
      table.perfiosTransactionId,
    ),
    statusAnalyzedIdx: index("idx_bank_statements_status_analyzed").on(
      table.status,
      table.analyzedAt,
    ),
    chkMonths: check(
      "chk_bank_statements_months",
      sql.raw("months IS NULL OR months BETWEEN 6 AND 12"),
    ),
  }),
);

/**
 * Server-side overrides for team and advisor copy.
 *
 * The JSON translation files remain the source of truth; rows here provide
 * runtime fallbacks or edge-case overrides per person, locale, and field.
 */
export const teamLocalizationMap = pgTable(
  "team_localization_map",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: varchar("person_id", { length: 64 }).notNull(),
    kind: teamLocalizationKindEnum("kind").notNull(),
    locale: varchar("locale", { length: 5 }).notNull(),
    field: teamLocalizationFieldEnum("field").notNull(),
    value: text("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniquePersonLocaleFieldIdx: uniqueIndex("idx_team_loc_map_unique").on(
      table.personId,
      table.kind,
      table.locale,
      table.field,
    ),
    localeKindIdx: index("idx_team_loc_map_locale_kind").on(table.locale, table.kind),
  }),
);

/**
 * Encrypted premium apply form wizard state.
 *
 * PII is encrypted by the application layer before storage using AES-256-GCM
 * and never written to this column in plaintext. loan_amount is stored as
 * integer INR rupees (no floats or currency conversions at this layer).
 */
export const applicationState = pgTable(
  "application_state",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: varchar("reference", { length: 32 }).notNull().unique(),
    locale: varchar("locale", { length: 5 }).notNull(),
    encryptedPayload: text("encrypted_payload").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    referenceIdx: index("idx_application_state_reference").on(table.reference),
    expiresIdx: index("idx_application_state_expires").on(table.expiresAt),
  }),
);
