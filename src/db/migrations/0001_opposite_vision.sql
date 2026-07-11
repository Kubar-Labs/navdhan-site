CREATE TYPE "public"."bank_statement_status" AS ENUM('pending', 'success', 'failure', 'partial');--> statement-breakpoint
CREATE TABLE "bank_statements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"bank_name" varchar(127),
	"account_number_encrypted" text,
	"account_number_last_four" varchar(4),
	"perfios_transaction_id" varchar(255),
	"months" smallint,
	"status" "bank_statement_status" DEFAULT 'pending' NOT NULL,
	"analysis_score" numeric(5, 2),
	"analyzed_at" timestamp with time zone,
	"raw_payload" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_bank_statements_months" CHECK (months IS NULL OR months BETWEEN 6 AND 12)
);
--> statement-breakpoint
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bank_statements_application_id" ON "bank_statements" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_bank_statements_perfios_transaction_id" ON "bank_statements" USING btree ("perfios_transaction_id");--> statement-breakpoint
CREATE INDEX "idx_bank_statements_status_analyzed" ON "bank_statements" USING btree ("status","analyzed_at");