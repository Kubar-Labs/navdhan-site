CREATE TYPE "public"."application_status" AS ENUM('draft', 'submitted', 'declined', 'expired');--> statement-breakpoint
CREATE TYPE "public"."application_step" AS ENUM('loan_intent', 'personal_contact', 'aadhaar_verification', 'pan_verification', 'gst_verification', 'itr_upload', 'bank_statements', 'review_submit', 'submission_result');--> statement-breakpoint
CREATE TYPE "public"."consent_step" AS ENUM('aadhaar_verification', 'itr_upload', 'bank_statements', 'review_submit');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('pending', 'uploaded', 'scanned', 'failed');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('itr', 'bank_statement', 'gst_return', 'other');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('draft_created', 'step_transition', 'otp_sent', 'otp_verified', 'otp_failed', 'consent_recorded', 'document_uploaded', 'document_scan_completed', 'perfios_initiated', 'perfios_callback_received', 'application_submitted', 'submission_failed', 'offer_received', 'offer_selected');--> statement-breakpoint
CREATE TYPE "public"."loan_purpose" AS ENUM('working_capital', 'machinery', 'inventory', 'business_expansion', 'debt_refinancing', 'other');--> statement-breakpoint
CREATE TYPE "public"."offer_status" AS ENUM('eligible', 'selected', 'expired', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."perfios_status" AS ENUM('pending', 'success', 'failure', 'partial');--> statement-breakpoint
CREATE TYPE "public"."scan_result" AS ENUM('clean', 'infected', 'unreadable');--> statement-breakpoint
CREATE TABLE "applicants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"pii_key_id" varchar(255) DEFAULT 'v1' NOT NULL,
	"full_name" text,
	"mobile_number_hash" varchar(64),
	"mobile_number_encrypted" text,
	"mobile_number_last_four" varchar(4),
	"email_hash" varchar(64),
	"email_encrypted" text,
	"business_pin_code" varchar(6),
	"aadhaar_hash" varchar(64),
	"aadhaar_last_four" varchar(4),
	"aadhaar_verified" boolean DEFAULT false NOT NULL,
	"aadhaar_verified_at" timestamp with time zone,
	"pan_hash" varchar(64),
	"pan_encrypted" text,
	"pan_masked" varchar(10),
	"pan_verified" boolean DEFAULT false NOT NULL,
	"pan_verified_at" timestamp with time zone,
	"gstin" varchar(15),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_applicants_business_pin_code" CHECK (business_pin_code IS NULL OR business_pin_code ~ '^[1-9][0-9]{5}$'),
	CONSTRAINT "chk_applicants_gstin" CHECK (gstin IS NULL OR gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$')
);
--> statement-breakpoint
CREATE TABLE "application_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "application_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"application_id" uuid NOT NULL,
	"event_type" "event_type" NOT NULL,
	"step_id" "application_step",
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar(255) NOT NULL,
	"reference_number" varchar(32),
	"status" "application_status" DEFAULT 'draft' NOT NULL,
	"current_step" "application_step" DEFAULT 'loan_intent' NOT NULL,
	"loan_amount" numeric(19, 4),
	"tenure_months" smallint,
	"purpose" "loan_purpose",
	"referral_code" varchar(20),
	"gstin_skipped" boolean DEFAULT false NOT NULL,
	"perfios_transaction_id" varchar(255),
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_applications_loan_amount" CHECK (loan_amount IS NULL OR (loan_amount BETWEEN 500000.0000 AND 10000000.0000 AND loan_amount % 10000 = 0)),
	CONSTRAINT "chk_applications_tenure" CHECK ("applications"."tenure_months" IS NULL OR "applications"."tenure_months" BETWEEN 3 AND 12),
	CONSTRAINT "chk_applications_referral" CHECK (referral_code IS NULL OR referral_code ~ '^[A-Za-z0-9_-]+$')
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"step_id" "consent_step" NOT NULL,
	"consent_key" varchar(127) NOT NULL,
	"accepted" boolean NOT NULL,
	"statement_snapshot" text NOT NULL,
	"locale" varchar(5) NOT NULL,
	"client_ip_hash" varchar(64) NOT NULL,
	"user_agent_hash" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"document_type" "document_type" NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"mime_type" varchar(127) NOT NULL,
	"storage_path" text NOT NULL,
	"encryption_key_id" varchar(255) NOT NULL,
	"file_size_bytes" bigint NOT NULL,
	"status" "document_status" DEFAULT 'pending' NOT NULL,
	"scan_result" "scan_result",
	"financial_year" varchar(7),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_documents_mime_type" CHECK (mime_type = 'application/pdf'),
	CONSTRAINT "chk_documents_file_size" CHECK (file_size_bytes > 0 AND file_size_bytes <= 5242880)
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"scope" varchar(255) NOT NULL,
	"request_path" varchar(255) NOT NULL,
	"payload_hash" varchar(64) NOT NULL,
	"response_status" smallint NOT NULL,
	"response_body" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lender_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"lender_name" varchar(127) NOT NULL,
	"lender_logo_url" text,
	"loan_amount" numeric(19, 4) NOT NULL,
	"interest_rate_annual" numeric(5, 2) NOT NULL,
	"tenure_months" smallint NOT NULL,
	"emi_amount" numeric(19, 4) NOT NULL,
	"total_interest" numeric(19, 4) NOT NULL,
	"processing_fee" numeric(19, 4) DEFAULT '0.0000' NOT NULL,
	"net_disbursal" numeric(19, 4) NOT NULL,
	"status" "offer_status" DEFAULT 'eligible' NOT NULL,
	"expires_at" timestamp with time zone,
	"selected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_lender_offers_loan_amount" CHECK ("lender_offers"."loan_amount" > 0),
	CONSTRAINT "chk_lender_offers_interest_rate" CHECK ("lender_offers"."interest_rate_annual" > 0),
	CONSTRAINT "chk_lender_offers_tenure" CHECK ("lender_offers"."tenure_months" BETWEEN 3 AND 12)
);
--> statement-breakpoint
CREATE TABLE "otp_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"channel" varchar(16) NOT NULL,
	"destination_hash" varchar(64) NOT NULL,
	"otp_reference_id" varchar(64) NOT NULL,
	"purpose" varchar(32) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"attempt_count" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "otp_attempts_otp_reference_id_unique" UNIQUE("otp_reference_id"),
	CONSTRAINT "chk_otp_attempts_channel" CHECK ("otp_attempts"."channel" IN ('sms', 'aadhaar')),
	CONSTRAINT "chk_otp_attempts_attempt_count" CHECK ("otp_attempts"."attempt_count" >= 0 AND "otp_attempts"."attempt_count" <= 3)
);
--> statement-breakpoint
ALTER TABLE "applicants" ADD CONSTRAINT "applicants_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_offers" ADD CONSTRAINT "lender_offers_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_attempts" ADD CONSTRAINT "otp_attempts_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_applicants_application_id" ON "applicants" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_applicants_mobile_hash" ON "applicants" USING btree ("mobile_number_hash");--> statement-breakpoint
CREATE INDEX "idx_applicants_email_hash" ON "applicants" USING btree ("email_hash");--> statement-breakpoint
CREATE INDEX "idx_applicants_aadhaar_hash" ON "applicants" USING btree ("aadhaar_hash");--> statement-breakpoint
CREATE INDEX "idx_applicants_pan_hash" ON "applicants" USING btree ("pan_hash");--> statement-breakpoint
CREATE INDEX "idx_applicants_gstin" ON "applicants" USING btree ("gstin");--> statement-breakpoint
CREATE INDEX "idx_application_events_application_id" ON "application_events" USING btree ("application_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_application_events_type" ON "application_events" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE INDEX "idx_applications_session_id" ON "applications" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_applications_reference_number" ON "applications" USING btree ("reference_number");--> statement-breakpoint
CREATE INDEX "idx_applications_status_created" ON "applications" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_consents_application_key" ON "consents" USING btree ("application_id","consent_key");--> statement-breakpoint
CREATE INDEX "idx_consents_application_step" ON "consents" USING btree ("application_id","step_id");--> statement-breakpoint
CREATE INDEX "idx_consents_created" ON "consents" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_documents_application_id" ON "documents" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_documents_application_type" ON "documents" USING btree ("application_id","document_type");--> statement-breakpoint
CREATE INDEX "idx_documents_status" ON "documents" USING btree ("status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_idempotency_keys_lookup" ON "idempotency_keys" USING btree ("key_hash","scope") WHERE "idempotency_keys"."expires_at" > now();--> statement-breakpoint
CREATE INDEX "idx_idempotency_keys_expires" ON "idempotency_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_lender_offers_application_id" ON "lender_offers" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_lender_offers_status" ON "lender_offers" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_lender_offers_application_status" ON "lender_offers" USING btree ("application_id","status") WHERE "lender_offers"."status" = 'selected';--> statement-breakpoint
CREATE UNIQUE INDEX "idx_otp_attempts_reference" ON "otp_attempts" USING btree ("otp_reference_id");--> statement-breakpoint
CREATE INDEX "idx_otp_attempts_destination" ON "otp_attempts" USING btree ("destination_hash","created_at");--> statement-breakpoint
CREATE INDEX "idx_otp_attempts_application" ON "otp_attempts" USING btree ("application_id","created_at");