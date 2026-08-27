BEGIN;

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE entity_constitution AS ENUM ('proprietorship', 'partnership', 'private_limited', 'llp', 'one_person_company', 'public_limited', 'huf', 'trust', 'society', 'section_8_company', 'individual');
CREATE TYPE party_role AS ENUM ('applicant', 'co_applicant', 'proprietor', 'partner', 'director', 'shareholder', 'authorised_signatory', 'guarantor', 'trustee', 'karta');
CREATE TYPE application_status AS ENUM ('in_progress', 'kyc_pending', 'consent_pending', 'documents_pending', 'under_review', 'submitted', 'offer_issued', 'offer_accepted', 'sanctioned', 'agreement_pending', 'disbursed', 'rejected', 'withdrawn', 'expired', 'abandoned');
CREATE TYPE attaches_to AS ENUM ('entity', 'person', 'facility', 'document', 'registration');
CREATE TYPE obligation AS ENUM ('mandatory', 'optional', 'conditional');
CREATE TYPE coverage_mode AS ENUM ('none', 'month_range', 'fiscal_year', 'per_facility');
CREATE TYPE document_status AS ENUM ('uploading', 'uploaded', 'scan_failed', 'superseded', 'purged');
CREATE TYPE requirement_status AS ENUM ('pending', 'partial', 'collected', 'accepted_for_review', 'rejected', 'waived', 'not_applicable', 'missing');
CREATE TYPE registration_kind AS ENUM ('entity_pan', 'gstin', 'cin', 'llpin', 'udyam', 'shop_establishment', 'trade_license', 'vat_tin', 'iec', 'fssai', 'professional_tax');
CREATE TYPE identifier_kind AS ENUM ('pan', 'aadhaar', 'passport', 'voter_id', 'driving_licence', 'din', 'ckyc_id');
CREATE TYPE verification_state AS ENUM ('not_attempted', 'pending', 'passed', 'failed');
CREATE TYPE type_of_residence AS ENUM ('family_owned', 'owned', 'rented', 'other');
CREATE TYPE type_of_office AS ENUM ('factory_premises', 'home_office', 'owned_office', 'rented_office', 'other');
CREATE TYPE premises_ownership AS ENUM ('owned', 'rented', 'leased', 'family_owned');
CREATE TYPE periodicity AS ENUM ('none', 'monthly', 'quarterly', 'annual');
CREATE TYPE destination_type AS ENUM ('manual_dashboard', 'api', 'sftp', 'webhook');
CREATE TYPE facility_type AS ENUM ('home', 'personal', 'car', 'education', 'vehicle', 'business', 'gold', 'credit', 'other');
CREATE TYPE product_family AS ENUM ('point_of_sale', 'commercial', 'trade_finance');
CREATE TYPE lender_type AS ENUM ('bank', 'nbfc', 'sfb', 'co_lending_pool', 'fintech');
CREATE TYPE record_status AS ENUM ('onboarding', 'active', 'suspended', 'offboarded');
CREATE TYPE borrower_status AS ENUM ('active', 'blocked', 'purged');
CREATE TYPE checklist_status AS ENUM ('draft', 'active', 'retired');
CREATE TYPE document_category AS ENUM ('kyc', 'entity_proof', 'vintage', 'financial', 'banking', 'tax', 'obligation', 'premises', 'legal');
CREATE TYPE actor_type AS ENUM ('borrower', 'marketplace', 'ops', 'system', 'lender');
CREATE TYPE application_channel AS ENUM ('sdk_web', 'sdk_mobile', 'whatsapp', 'webapp', 'api', 'ops_console');
CREATE TYPE location_tier AS ENUM ('tier1', 'tier2', 'tier3');
CREATE TYPE scan_result AS ENUM ('pending', 'clean', 'infected', 'unreadable');
CREATE TYPE extraction_status AS ENUM ('not_attempted', 'pending', 'parsed', 'failed');
CREATE TYPE facility_source AS ENUM ('declared', 'bureau', 'bank_statement', 'gst');
CREATE TYPE identifier_source AS ENUM ('manual_entry', 'digilocker', 'ckyc', 'ocr_extracted', 'partner_prefill');
CREATE TYPE kyc_method AS ENUM ('v_cip', 'ckyc', 'digilocker', 'offline_aadhaar_xml', 'aadhaar_otp', 'physical');
CREATE TYPE verification_result AS ENUM ('passed', 'failed', 'inconclusive');
CREATE TYPE check_status AS ENUM ('pending', 'success', 'failed', 'error');
CREATE TYPE check_verdict AS ENUM ('match', 'mismatch', 'inconclusive');
CREATE TYPE registration_source AS ENUM ('gstn_api', 'mca_api', 'manual');
CREATE TYPE package_status AS ENUM ('draft', 'ready', 'submitted', 'acknowledged', 'rejected', 'failed');
CREATE TYPE payload_format AS ENUM ('ndp_v1', 'partner_json', 'csv');
CREATE TYPE outbox_status AS ENUM ('pending', 'processing', 'done', 'failed');
CREATE TYPE consent_action AS ENUM ('granted', 'revoked');
CREATE TYPE requirement_event_type AS ENUM ('status_change', 'waived', 'rejected', 'recalculated');
CREATE TYPE document_event_type AS ENUM ('uploaded', 'scanned', 'parsed', 'linked', 'unlinked', 'superseded', 'purged');
CREATE TYPE submission_event_type AS ENUM ('built', 'sent', 'acknowledged', 'rejected', 'retried');
CREATE TYPE outbox_topic AS ENUM ('scan', 'gcs_delete', 'reconcile', 'notify', 'submit');
CREATE TYPE score_source AS ENUM ('self_declared', 'bureau_fetched');

CREATE TABLE marketplaces (
    marketplace_id uuid PRIMARY KEY,
    code citext NOT NULL UNIQUE,
    legal_name text NOT NULL,
    display_name text NOT NULL,
    status record_status NOT NULL DEFAULT 'onboarding',
    data_region text NOT NULL DEFAULT 'asia-south1',
    settings jsonb NOT NULL DEFAULT '{}'::jsonb,
    contract_start_date date,
    contract_end_date date,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (contract_end_date IS NULL OR contract_start_date IS NULL OR contract_end_date >= contract_start_date)
);

CREATE TABLE lenders (
    lender_id uuid PRIMARY KEY,
    code citext NOT NULL UNIQUE,
    legal_name text NOT NULL,
    lender_type lender_type NOT NULL,
    rbi_licence_no text,
    status record_status NOT NULL DEFAULT 'onboarding',
    settings jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE loan_products (
    product_code citext PRIMARY KEY,
    family product_family NOT NULL,
    display_name text NOT NULL,
    is_secured boolean NOT NULL DEFAULT false,
    min_amount numeric(18,2),
    max_amount numeric(18,2),
    currency char(3) NOT NULL DEFAULT 'INR',
    min_tenure_months smallint,
    max_tenure_months smallint,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (min_amount IS NULL OR min_amount >= 0),
    CHECK (max_amount IS NULL OR max_amount >= 0),
    CHECK (min_amount IS NULL OR max_amount IS NULL OR min_amount <= max_amount),
    CHECK (min_tenure_months IS NULL OR min_tenure_months > 0),
    CHECK (max_tenure_months IS NULL OR max_tenure_months > 0),
    CHECK (min_tenure_months IS NULL OR max_tenure_months IS NULL OR min_tenure_months <= max_tenure_months)
);

CREATE TABLE destinations (
    destination_id uuid PRIMARY KEY,
    code citext NOT NULL UNIQUE,
    display_name text NOT NULL,
    destination_type destination_type NOT NULL,
    lender_id uuid REFERENCES lenders (lender_id),
    payload_format payload_format NOT NULL,
    endpoint_config jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE business_types (
    code citext PRIMARY KEY,
    display_name text NOT NULL,
    destination_id uuid REFERENCES destinations (destination_id),
    external_value text,
    is_active boolean NOT NULL DEFAULT true,
    display_order integer NOT NULL DEFAULT 0
);

CREATE TABLE employment_statuses (
    code citext PRIMARY KEY,
    display_name text NOT NULL,
    destination_id uuid REFERENCES destinations (destination_id),
    external_value text,
    is_active boolean NOT NULL DEFAULT true,
    display_order integer NOT NULL DEFAULT 0
);

CREATE TABLE income_types (
    code citext PRIMARY KEY,
    display_name text NOT NULL,
    destination_id uuid REFERENCES destinations (destination_id),
    external_value text,
    is_active boolean NOT NULL DEFAULT true,
    display_order integer NOT NULL DEFAULT 0
);

CREATE TABLE retention_classes (
    retention_class_code citext PRIMARY KEY,
    display_name text NOT NULL,
    retention_months integer NOT NULL CHECK (retention_months > 0),
    legal_basis text NOT NULL,
    purge_pii_only boolean NOT NULL DEFAULT false
);

CREATE TABLE verification_providers (
    provider_code citext PRIMARY KEY,
    display_name text NOT NULL,
    is_active boolean NOT NULL DEFAULT false,
    config jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE verification_check_types (
    check_type_code citext PRIMARY KEY,
    display_name text NOT NULL,
    attaches_to attaches_to NOT NULL,
    default_provider_code citext REFERENCES verification_providers (provider_code),
    unit_cost_paise integer NOT NULL DEFAULT 0 CHECK (unit_cost_paise >= 0),
    is_enabled boolean NOT NULL DEFAULT false
);

CREATE TABLE marketplace_product_offerings (
    offering_id uuid PRIMARY KEY,
    marketplace_id uuid NOT NULL REFERENCES marketplaces (marketplace_id),
    lender_id uuid NOT NULL REFERENCES lenders (lender_id),
    product_code citext NOT NULL REFERENCES loan_products (product_code),
    is_active boolean NOT NULL DEFAULT true,
    effective_from date NOT NULL,
    effective_to date,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (marketplace_id, offering_id),
    UNIQUE (marketplace_id, offering_id, lender_id, product_code),
    UNIQUE (marketplace_id, lender_id, product_code, effective_from),
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE offering_constitutions (
    marketplace_id uuid NOT NULL DEFAULT nullif(current_setting('app.current_marketplace_id', true), '')::uuid,
    offering_id uuid NOT NULL,
    constitution entity_constitution NOT NULL,
    PRIMARY KEY (offering_id, constitution),
    UNIQUE (marketplace_id, offering_id, constitution),
    FOREIGN KEY (marketplace_id, offering_id)
        REFERENCES marketplace_product_offerings (marketplace_id, offering_id)
        ON DELETE CASCADE
);

CREATE TABLE document_types (
    document_type_code citext PRIMARY KEY,
    display_name text NOT NULL,
    category document_category NOT NULL,
    attaches_to attaches_to NOT NULL,
    is_periodic boolean NOT NULL DEFAULT false,
    periodicity periodicity NOT NULL DEFAULT 'none',
    is_multi_instance boolean NOT NULL DEFAULT false,
    allows_consolidated_file boolean NOT NULL DEFAULT false,
    max_size_bytes integer NOT NULL CHECK (max_size_bytes > 0),
    max_page_count integer CHECK (max_page_count > 0),
    retention_class_code citext NOT NULL REFERENCES retention_classes (retention_class_code),
    extraction_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (document_type_code, attaches_to),
    CHECK ((is_periodic AND periodicity <> 'none') OR (NOT is_periodic AND periodicity = 'none'))
);

CREATE TABLE document_type_mime_types (
    document_type_code citext NOT NULL REFERENCES document_types (document_type_code) ON DELETE CASCADE,
    mime_type text NOT NULL,
    PRIMARY KEY (document_type_code, mime_type)
);

CREATE TABLE checklist_versions (
    checklist_version_id uuid PRIMARY KEY,
    name text NOT NULL,
    version_no integer NOT NULL CHECK (version_no > 0),
    product_code citext NOT NULL REFERENCES loan_products (product_code),
    constitution entity_constitution NOT NULL,
    lender_id uuid REFERENCES lenders (lender_id),
    marketplace_id uuid NOT NULL REFERENCES marketplaces (marketplace_id),
    status checklist_status NOT NULL DEFAULT 'draft',
    effective_from date NOT NULL,
    effective_to date,
    published_by text,
    published_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (marketplace_id, checklist_version_id),
    UNIQUE (marketplace_id, checklist_version_id, product_code, constitution),
    CHECK (effective_to IS NULL OR effective_to >= effective_from),
    CHECK (status <> 'active' OR published_at IS NOT NULL)
);

CREATE UNIQUE INDEX checklist_versions_scope_version_uq
    ON checklist_versions (product_code, constitution, COALESCE(lender_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(marketplace_id, '00000000-0000-0000-0000-000000000000'::uuid), version_no);

CREATE TABLE document_requirements (
    requirement_id uuid PRIMARY KEY,
    marketplace_id uuid NOT NULL DEFAULT nullif(current_setting('app.current_marketplace_id', true), '')::uuid,
    checklist_version_id uuid NOT NULL,
    document_type_code citext NOT NULL,
    attaches_to attaches_to NOT NULL,
    party_role party_role,
    obligation obligation NOT NULL,
    blocks_submission boolean NOT NULL DEFAULT true,
    alt_group text,
    condition jsonb NOT NULL DEFAULT '{}'::jsonb,
    coverage_mode coverage_mode NOT NULL DEFAULT 'none',
    lookback_months integer CHECK (lookback_months > 0),
    fixed_period_start date,
    min_count integer NOT NULL DEFAULT 1 CHECK (min_count > 0),
    display_order integer NOT NULL DEFAULT 0,
    notes text,
    UNIQUE (marketplace_id, requirement_id),
    FOREIGN KEY (document_type_code, attaches_to) REFERENCES document_types (document_type_code, attaches_to),
    FOREIGN KEY (marketplace_id, checklist_version_id)
        REFERENCES checklist_versions (marketplace_id, checklist_version_id)
        ON DELETE CASCADE,
    CHECK ((attaches_to = 'person' AND party_role IS NOT NULL) OR attaches_to <> 'person')
);

CREATE TABLE borrowers (
    borrower_id uuid PRIMARY KEY,
    marketplace_id uuid NOT NULL REFERENCES marketplaces (marketplace_id),
    external_ref text NOT NULL,
    constitution entity_constitution NOT NULL,
    legal_name text,
    trade_name text,
    date_of_incorporation date,
    business_type_code citext REFERENCES business_types (code),
    industry_nic_code text,
    annual_turnover numeric(18,2) CHECK (annual_turnover >= 0),
    turnover_currency char(3) NOT NULL DEFAULT 'INR',
    type_of_office type_of_office,
    premises_ownership premises_ownership,
    location_tier location_tier,
    registered_address jsonb NOT NULL DEFAULT '{}'::jsonb,
    operating_address jsonb NOT NULL DEFAULT '{}'::jsonb,
    attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
    status borrower_status NOT NULL DEFAULT 'active',
    pii_purge_after timestamptz,
    pii_purged_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (marketplace_id, external_ref),
    UNIQUE (marketplace_id, borrower_id)
);

CREATE INDEX borrowers_attributes_gin_idx ON borrowers USING gin (attributes);

CREATE TABLE borrower_registrations (
    registration_id uuid PRIMARY KEY,
    marketplace_id uuid NOT NULL,
    borrower_id uuid NOT NULL,
    kind registration_kind NOT NULL,
    value_enc bytea,
    value_hash bytea NOT NULL,
    masked_value text NOT NULL,
    state_code char(2),
    issued_on date,
    valid_till date,
    is_primary boolean NOT NULL DEFAULT false,
    verification_state verification_state NOT NULL DEFAULT 'not_attempted',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (marketplace_id, registration_id),
    UNIQUE (marketplace_id, borrower_id, kind, value_hash),
    FOREIGN KEY (marketplace_id, borrower_id) REFERENCES borrowers (marketplace_id, borrower_id),
    CHECK (valid_till IS NULL OR issued_on IS NULL OR valid_till >= issued_on)
);

CREATE UNIQUE INDEX borrower_registrations_primary_kind_uq
    ON borrower_registrations (marketplace_id, borrower_id, kind) WHERE is_primary;

CREATE TABLE persons (
    person_id uuid PRIMARY KEY,
    marketplace_id uuid NOT NULL REFERENCES marketplaces (marketplace_id),
    full_name text,
    date_of_birth date,
    gender text,
    mobile_enc bytea,
    mobile_hash bytea,
    email_enc bytea,
    email_hash bytea,
    address jsonb NOT NULL DEFAULT '{}'::jsonb,
    type_of_residence type_of_residence,
    employment_status_code citext REFERENCES employment_statuses (code),
    kyc_state verification_state NOT NULL DEFAULT 'not_attempted',
    pii_purge_after timestamptz,
    pii_purged_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (marketplace_id, person_id)
);

CREATE INDEX persons_mobile_hash_idx ON persons (marketplace_id, mobile_hash) WHERE mobile_hash IS NOT NULL;
CREATE INDEX persons_email_hash_idx ON persons (marketplace_id, email_hash) WHERE email_hash IS NOT NULL;

CREATE TABLE person_identifiers (
    identifier_id uuid PRIMARY KEY,
    marketplace_id uuid NOT NULL,
    person_id uuid NOT NULL,
    id_type identifier_kind NOT NULL,
    value_enc bytea,
    value_hash bytea,
    masked_value text,
    issued_on date,
    valid_till date,
    source identifier_source NOT NULL,
    source_document_id uuid,
    verification_state verification_state NOT NULL DEFAULT 'not_attempted',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    purged_at timestamptz,
    UNIQUE (marketplace_id, identifier_id),
    UNIQUE (marketplace_id, person_id, id_type),
    FOREIGN KEY (marketplace_id, person_id) REFERENCES persons (marketplace_id, person_id),
    CHECK (valid_till IS NULL OR issued_on IS NULL OR valid_till >= issued_on),
    CHECK (purged_at IS NOT NULL OR value_hash IS NOT NULL)
);

CREATE INDEX person_identifiers_value_hash_idx ON person_identifiers (marketplace_id, id_type, value_hash) WHERE value_hash IS NOT NULL;

CREATE TABLE borrower_persons (
    borrower_person_id uuid PRIMARY KEY,
    marketplace_id uuid NOT NULL,
    borrower_id uuid NOT NULL,
    person_id uuid NOT NULL,
    role party_role NOT NULL,
    ownership_pct numeric(5,2),
    is_authorised_signatory boolean NOT NULL DEFAULT false,
    is_beneficial_owner boolean NOT NULL DEFAULT false,
    effective_from date NOT NULL,
    effective_to date,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (marketplace_id, borrower_id) REFERENCES borrowers (marketplace_id, borrower_id),
    FOREIGN KEY (marketplace_id, person_id) REFERENCES persons (marketplace_id, person_id),
    CHECK (ownership_pct IS NULL OR ownership_pct BETWEEN 0 AND 100),
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE UNIQUE INDEX borrower_persons_current_role_uq
    ON borrower_persons (marketplace_id, borrower_id, person_id, role) WHERE effective_to IS NULL;

CREATE TABLE loan_applications (
    application_id uuid PRIMARY KEY,
    marketplace_id uuid NOT NULL,
    borrower_id uuid NOT NULL,
    application_no text NOT NULL,
    product_code citext NOT NULL REFERENCES loan_products (product_code),
    constitution entity_constitution NOT NULL,
    vintage_months integer CHECK (vintage_months >= 0),
    lender_id uuid REFERENCES lenders (lender_id),
    offering_id uuid,
    checklist_version_id uuid NOT NULL,
    status application_status NOT NULL DEFAULT 'in_progress',
    requested_amount numeric(18,2) CHECK (requested_amount > 0),
    approved_amount numeric(18,2) CHECK (approved_amount >= 0),
    currency char(3) NOT NULL DEFAULT 'INR',
    requested_tenure_months smallint CHECK (requested_tenure_months > 0),
    income_type_code citext REFERENCES income_types (code),
    purpose text,
    channel application_channel NOT NULL,
    sdk_version text,
    lock_version integer NOT NULL DEFAULT 0 CHECK (lock_version >= 0),
    expires_at timestamptz,
    abandoned_at timestamptz,
    submitted_at timestamptz,
    decision_at timestamptz,
    disbursed_at timestamptz,
    rejection_reason text,
    attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (marketplace_id, application_no),
    UNIQUE (marketplace_id, application_id),
    UNIQUE (marketplace_id, application_id, borrower_id),
    FOREIGN KEY (marketplace_id, borrower_id) REFERENCES borrowers (marketplace_id, borrower_id),
    FOREIGN KEY (marketplace_id, offering_id) REFERENCES marketplace_product_offerings (marketplace_id, offering_id),
    FOREIGN KEY (marketplace_id, checklist_version_id) REFERENCES checklist_versions (marketplace_id, checklist_version_id),
    FOREIGN KEY (marketplace_id, checklist_version_id, product_code, constitution)
        REFERENCES checklist_versions (marketplace_id, checklist_version_id, product_code, constitution),
    FOREIGN KEY (marketplace_id, offering_id, lender_id, product_code)
        REFERENCES marketplace_product_offerings (marketplace_id, offering_id, lender_id, product_code),
    FOREIGN KEY (marketplace_id, offering_id, constitution)
        REFERENCES offering_constitutions (marketplace_id, offering_id, constitution),
    CHECK (offering_id IS NULL OR lender_id IS NOT NULL)
);

CREATE TABLE application_sessions (
    session_id uuid PRIMARY KEY,
    marketplace_id uuid NOT NULL REFERENCES marketplaces (marketplace_id),
    application_id uuid,
    token_hash bytea NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz,
    FOREIGN KEY (marketplace_id, application_id) REFERENCES loan_applications (marketplace_id, application_id),
    CHECK (expires_at > created_at)
);

CREATE INDEX application_sessions_active_idx ON application_sessions (marketplace_id, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE application_parties (
    application_party_id uuid PRIMARY KEY,
    marketplace_id uuid NOT NULL,
    application_id uuid NOT NULL,
    person_id uuid NOT NULL,
    role party_role NOT NULL,
    is_primary boolean NOT NULL DEFAULT false,
    ownership_pct numeric(5,2),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (marketplace_id, application_party_id),
    UNIQUE (marketplace_id, application_id, application_party_id),
    FOREIGN KEY (marketplace_id, application_id) REFERENCES loan_applications (marketplace_id, application_id),
    FOREIGN KEY (marketplace_id, person_id) REFERENCES persons (marketplace_id, person_id),
    CHECK (ownership_pct IS NULL OR ownership_pct BETWEEN 0 AND 100)
);

CREATE UNIQUE INDEX application_parties_primary_uq ON application_parties (marketplace_id, application_id) WHERE is_primary;
CREATE UNIQUE INDEX application_parties_role_uq ON application_parties (marketplace_id, application_id, person_id, role);

CREATE TABLE application_status_events (
    event_id uuid PRIMARY KEY,
    marketplace_id uuid NOT NULL,
    application_id uuid NOT NULL,
    from_status application_status,
    to_status application_status NOT NULL,
    reason_code text,
    reason_text text,
    actor_type actor_type NOT NULL,
    actor_ref text,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    FOREIGN KEY (marketplace_id, application_id) REFERENCES loan_applications (marketplace_id, application_id)
);

CREATE TABLE application_credit_declarations (
    declaration_id uuid PRIMARY KEY,
    marketplace_id uuid NOT NULL,
    application_id uuid NOT NULL,
    application_party_id uuid NOT NULL,
    declared_cibil_score integer CHECK (declared_cibil_score BETWEEN 300 AND 900),
    score_source score_source NOT NULL DEFAULT 'self_declared',
    has_active_credit_facilities boolean NOT NULL,
    declared_at timestamptz NOT NULL,
    superseded_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (marketplace_id, application_id) REFERENCES loan_applications (marketplace_id, application_id),
    FOREIGN KEY (marketplace_id, application_id, application_party_id)
        REFERENCES application_parties (marketplace_id, application_id, application_party_id)
);

CREATE TABLE application_existing_credit_facilities (
    facility_id uuid PRIMARY KEY,
    marketplace_id uuid NOT NULL,
    application_id uuid NOT NULL,
    facility_type facility_type NOT NULL,
    lender_name text NOT NULL,
    original_loan_amount numeric(18,2) CHECK (original_loan_amount >= 0),
    outstanding_amount numeric(18,2) CHECK (outstanding_amount >= 0),
    emi_amount numeric(18,2) CHECK (emi_amount >= 0),
    interest_rate_percent numeric(5,2) CHECK (interest_rate_percent BETWEEN 0 AND 100),
    currency char(3) NOT NULL DEFAULT 'INR',
    tenure_months smallint CHECK (tenure_months > 0),
    start_date date,
    end_date date,
    emis_paid_count integer CHECK (emis_paid_count >= 0),
    total_amount_paid numeric(18,2) CHECK (total_amount_paid >= 0),
    is_closed boolean NOT NULL DEFAULT false,
    source facility_source NOT NULL DEFAULT 'declared',
    declared_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (marketplace_id, facility_id),
    UNIQUE (marketplace_id, application_id, facility_id),
    FOREIGN KEY (marketplace_id, application_id) REFERENCES loan_applications (marketplace_id, application_id),
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE TABLE application_requirements (
    application_requirement_id uuid PRIMARY KEY,
    marketplace_id uuid NOT NULL,
    application_id uuid NOT NULL,
    requirement_id uuid NOT NULL,
    document_type_code citext NOT NULL,
    attaches_to attaches_to NOT NULL,
    application_party_id uuid,
    facility_id uuid,
    obligation obligation NOT NULL,
    blocks_submission boolean NOT NULL DEFAULT true,
    alt_group text,
    coverage_mode coverage_mode NOT NULL DEFAULT 'none',
    min_count integer NOT NULL DEFAULT 1 CHECK (min_count > 0),
    required_period_from date,
    required_period_to date,
    fiscal_year_start date,
    cached_coverage_state jsonb NOT NULL DEFAULT '{}'::jsonb,
    status requirement_status NOT NULL DEFAULT 'pending',
    reviewed_by text,
    reviewed_at timestamptz,
    waived_by text,
    waiver_reason text,
    waived_at timestamptz,
    due_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (marketplace_id, application_requirement_id),
    UNIQUE (marketplace_id, application_id, application_requirement_id),
    FOREIGN KEY (marketplace_id, application_id) REFERENCES loan_applications (marketplace_id, application_id),
    FOREIGN KEY (marketplace_id, requirement_id) REFERENCES document_requirements (marketplace_id, requirement_id),
    FOREIGN KEY (marketplace_id, application_id, application_party_id) REFERENCES application_parties (marketplace_id, application_id, application_party_id),
    FOREIGN KEY (marketplace_id, application_id, facility_id) REFERENCES application_existing_credit_facilities (marketplace_id, application_id, facility_id),
    CHECK (required_period_to IS NULL OR required_period_from IS NULL OR required_period_to >= required_period_from),
    CHECK ((attaches_to = 'person' AND application_party_id IS NOT NULL AND facility_id IS NULL) OR (attaches_to = 'facility' AND facility_id IS NOT NULL AND application_party_id IS NULL) OR (attaches_to NOT IN ('person', 'facility') AND application_party_id IS NULL AND facility_id IS NULL))
);

CREATE TABLE application_requirement_events (
    event_id uuid PRIMARY KEY,
    marketplace_id uuid NOT NULL,
    application_requirement_id uuid NOT NULL,
    event_type requirement_event_type NOT NULL,
    from_status requirement_status,
    to_status requirement_status,
    reason text,
    actor_type actor_type NOT NULL,
    actor_ref text,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    FOREIGN KEY (marketplace_id, application_requirement_id) REFERENCES application_requirements (marketplace_id, application_requirement_id)
);

CREATE TABLE documents (
    document_id uuid PRIMARY KEY,
    marketplace_id uuid NOT NULL,
    application_id uuid NOT NULL,
    document_type_code citext NOT NULL REFERENCES document_types (document_type_code),
    attaches_to attaches_to NOT NULL,
    borrower_id uuid,
    application_party_id uuid,
    facility_id uuid,
    gcs_bucket text NOT NULL,
    gcs_object text NOT NULL,
    gcs_generation bigint,
    sha256 bytea,
    mime_type text NOT NULL,
    size_bytes integer NOT NULL CHECK (size_bytes >= 0),
    page_count integer CHECK (page_count > 0),
    is_password_protected boolean NOT NULL DEFAULT false,
    coverage_from date,
    coverage_to date,
    fiscal_year_start date,
    status document_status NOT NULL DEFAULT 'uploading',
    scan_result scan_result NOT NULL DEFAULT 'pending',
    extraction_status extraction_status NOT NULL DEFAULT 'not_attempted',
    extracted_data jsonb,
    supersedes_document_id uuid,
    idempotency_key text NOT NULL,
    uploaded_by_type actor_type NOT NULL,
    uploaded_by_ref text,
    uploaded_at timestamptz,
    retention_expires_at timestamptz,
    purged_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (marketplace_id, document_id),
    UNIQUE (marketplace_id, application_id, document_id),
    UNIQUE (marketplace_id, idempotency_key),
    FOREIGN KEY (document_type_code, attaches_to) REFERENCES document_types (document_type_code, attaches_to),
    FOREIGN KEY (marketplace_id, application_id) REFERENCES loan_applications (marketplace_id, application_id),
    FOREIGN KEY (marketplace_id, application_id, borrower_id) REFERENCES loan_applications (marketplace_id, application_id, borrower_id),
    FOREIGN KEY (marketplace_id, application_id, application_party_id) REFERENCES application_parties (marketplace_id, application_id, application_party_id),
    FOREIGN KEY (marketplace_id, application_id, facility_id) REFERENCES application_existing_credit_facilities (marketplace_id, application_id, facility_id),
    FOREIGN KEY (marketplace_id, supersedes_document_id) REFERENCES documents (marketplace_id, document_id),
    CHECK (coverage_to IS NULL OR coverage_from IS NULL OR coverage_to >= coverage_from),
    CHECK ((attaches_to = 'entity' AND borrower_id IS NOT NULL AND application_party_id IS NULL AND facility_id IS NULL) OR (attaches_to = 'person' AND borrower_id IS NULL AND application_party_id IS NOT NULL AND facility_id IS NULL) OR (attaches_to = 'facility' AND borrower_id IS NULL AND application_party_id IS NULL AND facility_id IS NOT NULL))
);

ALTER TABLE person_identifiers
    ADD FOREIGN KEY (marketplace_id, source_document_id) REFERENCES documents (marketplace_id, document_id);

CREATE TABLE document_requirement_satisfactions (
    satisfaction_id uuid PRIMARY KEY,
    marketplace_id uuid NOT NULL,
    application_id uuid NOT NULL,
    application_requirement_id uuid NOT NULL,
    document_id uuid NOT NULL,
    linked_by_type actor_type NOT NULL,
    linked_by_ref text,
    linked_at timestamptz NOT NULL DEFAULT now(),
    unlinked_at timestamptz,
    unlink_reason text,
    FOREIGN KEY (marketplace_id, application_id) REFERENCES loan_applications (marketplace_id, application_id),
    FOREIGN KEY (marketplace_id, application_id, application_requirement_id) REFERENCES application_requirements (marketplace_id, application_id, application_requirement_id),
    FOREIGN KEY (marketplace_id, application_id, document_id) REFERENCES documents (marketplace_id, application_id, document_id)
);

CREATE FUNCTION enforce_satisfaction_document_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.application_requirements AS requirement
        JOIN public.documents AS document
          ON document.marketplace_id = requirement.marketplace_id
         AND document.application_id = requirement.application_id
         AND document.document_id = NEW.document_id
        WHERE requirement.marketplace_id = NEW.marketplace_id
          AND requirement.application_id = NEW.application_id
          AND requirement.application_requirement_id = NEW.application_requirement_id
          AND document.document_type_code = requirement.document_type_code
          AND document.attaches_to = requirement.attaches_to
    ) THEN
        RAISE EXCEPTION 'document scope does not match application requirement'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END
$function$;

CREATE TRIGGER document_requirement_satisfaction_scope
    BEFORE INSERT OR UPDATE OF marketplace_id, application_id, application_requirement_id, document_id
    ON document_requirement_satisfactions
    FOR EACH ROW
    EXECUTE FUNCTION enforce_satisfaction_document_scope();

CREATE UNIQUE INDEX document_requirement_satisfactions_live_uq
    ON document_requirement_satisfactions (application_requirement_id, document_id) WHERE unlinked_at IS NULL;

CREATE TABLE document_events (
    event_id uuid PRIMARY KEY,
    marketplace_id uuid NOT NULL,
    document_id uuid NOT NULL,
    event_type document_event_type NOT NULL,
    actor_type actor_type NOT NULL,
    actor_ref text,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    FOREIGN KEY (marketplace_id, document_id) REFERENCES documents (marketplace_id, document_id)
);

CREATE TABLE verification_checks (
    check_id uuid PRIMARY KEY,
    marketplace_id uuid NOT NULL,
    application_id uuid NOT NULL,
    attaches_to attaches_to NOT NULL,
    subject_id uuid NOT NULL,
    check_type_code citext NOT NULL REFERENCES verification_check_types (check_type_code),
    provider_code citext NOT NULL REFERENCES verification_providers (provider_code),
    provider_ref text,
    provider_api_version text,
    status check_status NOT NULL DEFAULT 'pending',
    verdict check_verdict,
    response_json jsonb,
    response_hash bytea,
    cost_paise integer NOT NULL DEFAULT 0 CHECK (cost_paise >= 0),
    requested_at timestamptz NOT NULL,
    completed_at timestamptz,
    latency_ms integer CHECK (latency_ms >= 0),
    retry_of_check_id uuid REFERENCES verification_checks (check_id),
    FOREIGN KEY (marketplace_id, application_id) REFERENCES loan_applications (marketplace_id, application_id)
);

CREATE TABLE person_kyc_verifications (
    kyc_verification_id uuid PRIMARY KEY,
    marketplace_id uuid NOT NULL,
    person_id uuid NOT NULL,
    method kyc_method NOT NULL,
    provider_code citext REFERENCES verification_providers (provider_code),
    reference_id text,
    response_hash bytea,
    result verification_result NOT NULL,
    is_full_kyc boolean NOT NULL,
    verified_at timestamptz NOT NULL,
    expires_at timestamptz,
    actor_type actor_type NOT NULL,
    actor_ref text,
    FOREIGN KEY (marketplace_id, person_id) REFERENCES persons (marketplace_id, person_id)
);

CREATE TABLE borrower_registration_verifications (
    verification_id uuid PRIMARY KEY,
    marketplace_id uuid NOT NULL,
    registration_id uuid NOT NULL,
    source registration_source NOT NULL,
    provider_code citext REFERENCES verification_providers (provider_code),
    reference_id text,
    result verification_result NOT NULL,
    response_hash bytea,
    verified_at timestamptz NOT NULL,
    FOREIGN KEY (marketplace_id, registration_id) REFERENCES borrower_registrations (marketplace_id, registration_id)
);

CREATE TABLE consent_purposes (
    purpose_code citext PRIMARY KEY,
    display_name text NOT NULL,
    notice_text text NOT NULL,
    notice_version integer NOT NULL CHECK (notice_version > 0),
    is_mandatory boolean NOT NULL DEFAULT false,
    retention_months integer NOT NULL CHECK (retention_months > 0),
    effective_from date NOT NULL,
    effective_to date,
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE consent_grants (
    grant_id uuid PRIMARY KEY,
    marketplace_id uuid NOT NULL,
    application_id uuid NOT NULL,
    person_id uuid NOT NULL,
    purpose_code citext NOT NULL REFERENCES consent_purposes (purpose_code),
    destination_id uuid NOT NULL REFERENCES destinations (destination_id),
    notice_version integer NOT NULL CHECK (notice_version > 0),
    action consent_action NOT NULL,
    artefact_hash bytea,
    ip_address inet,
    user_agent text,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (marketplace_id, application_id) REFERENCES loan_applications (marketplace_id, application_id),
    FOREIGN KEY (marketplace_id, person_id) REFERENCES persons (marketplace_id, person_id)
);

CREATE TABLE destination_field_mappings (
    mapping_id uuid PRIMARY KEY,
    destination_id uuid NOT NULL REFERENCES destinations (destination_id) ON DELETE CASCADE,
    source_path text NOT NULL,
    target_field text NOT NULL,
    transform jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_required boolean NOT NULL DEFAULT false,
    UNIQUE (destination_id, source_path)
);

CREATE TABLE submission_packages (
    package_id uuid PRIMARY KEY,
    marketplace_id uuid NOT NULL,
    application_id uuid NOT NULL,
    destination_id uuid NOT NULL REFERENCES destinations (destination_id),
    payload_snapshot jsonb NOT NULL,
    payload_hash bytea NOT NULL,
    status package_status NOT NULL DEFAULT 'draft',
    external_ref text,
    submitted_by_type actor_type,
    submitted_by_ref text,
    submitted_at timestamptz,
    acknowledged_at timestamptz,
    idempotency_key text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (marketplace_id, package_id),
    UNIQUE (marketplace_id, application_id, destination_id, idempotency_key),
    FOREIGN KEY (marketplace_id, application_id) REFERENCES loan_applications (marketplace_id, application_id)
);

CREATE TABLE submission_events (
    event_id uuid PRIMARY KEY,
    marketplace_id uuid NOT NULL,
    package_id uuid NOT NULL,
    event_type submission_event_type NOT NULL,
    actor_type actor_type NOT NULL,
    actor_ref text,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    FOREIGN KEY (marketplace_id, package_id) REFERENCES submission_packages (marketplace_id, package_id)
);

CREATE TABLE outbox_events (
    outbox_id uuid PRIMARY KEY,
    marketplace_id uuid REFERENCES marketplaces (marketplace_id),
    topic outbox_topic NOT NULL,
    payload jsonb NOT NULL,
    status outbox_status NOT NULL DEFAULT 'pending',
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    next_attempt_at timestamptz NOT NULL DEFAULT now(),
    locked_by text,
    locked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz
);

CREATE INDEX outbox_events_claim_idx ON outbox_events (status, next_attempt_at) WHERE status IN ('pending', 'failed');

CREATE TABLE audit_events (
    audit_id uuid NOT NULL,
    marketplace_id uuid NOT NULL REFERENCES marketplaces (marketplace_id),
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    action text NOT NULL,
    actor_type actor_type NOT NULL,
    actor_ref text,
    before jsonb,
    after jsonb,
    occurred_at timestamptz NOT NULL,
    PRIMARY KEY (audit_id, occurred_at)
) PARTITION BY RANGE (occurred_at);

CREATE TABLE audit_events_default PARTITION OF audit_events DEFAULT;

CREATE INDEX audit_events_entity_idx ON audit_events (marketplace_id, entity_type, entity_id, occurred_at DESC);

-- Tenant isolation uses a transaction-local setting populated by the application.
-- FORCE makes table owners subject to the same policies.
ALTER TABLE marketplaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplaces FORCE ROW LEVEL SECURITY;
ALTER TABLE marketplace_product_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_product_offerings FORCE ROW LEVEL SECURITY;
ALTER TABLE offering_constitutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE offering_constitutions FORCE ROW LEVEL SECURITY;
ALTER TABLE checklist_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE document_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_requirements FORCE ROW LEVEL SECURITY;
ALTER TABLE borrowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrowers FORCE ROW LEVEL SECURITY;
ALTER TABLE borrower_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrower_registrations FORCE ROW LEVEL SECURITY;
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE persons FORCE ROW LEVEL SECURITY;
ALTER TABLE person_identifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_identifiers FORCE ROW LEVEL SECURITY;
ALTER TABLE borrower_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrower_persons FORCE ROW LEVEL SECURITY;
ALTER TABLE loan_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_applications FORCE ROW LEVEL SECURITY;
ALTER TABLE application_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE application_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_parties FORCE ROW LEVEL SECURITY;
ALTER TABLE application_status_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_status_events FORCE ROW LEVEL SECURITY;
ALTER TABLE application_credit_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_credit_declarations FORCE ROW LEVEL SECURITY;
ALTER TABLE application_existing_credit_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_existing_credit_facilities FORCE ROW LEVEL SECURITY;
ALTER TABLE application_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_requirements FORCE ROW LEVEL SECURITY;
ALTER TABLE application_requirement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_requirement_events FORCE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;
ALTER TABLE document_requirement_satisfactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_requirement_satisfactions FORCE ROW LEVEL SECURITY;
ALTER TABLE document_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_events FORCE ROW LEVEL SECURITY;
ALTER TABLE verification_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_checks FORCE ROW LEVEL SECURITY;
ALTER TABLE person_kyc_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_kyc_verifications FORCE ROW LEVEL SECURITY;
ALTER TABLE borrower_registration_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrower_registration_verifications FORCE ROW LEVEL SECURITY;
ALTER TABLE consent_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_grants FORCE ROW LEVEL SECURITY;
ALTER TABLE submission_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_packages FORCE ROW LEVEL SECURITY;
ALTER TABLE submission_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_events FORCE ROW LEVEL SECURITY;
ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;

DO $rls$
DECLARE
    table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'marketplaces', 'marketplace_product_offerings', 'offering_constitutions',
        'checklist_versions', 'document_requirements',
        'borrowers', 'borrower_registrations', 'persons', 'person_identifiers',
        'borrower_persons', 'loan_applications', 'application_sessions',
        'application_parties', 'application_status_events',
        'application_credit_declarations', 'application_existing_credit_facilities',
        'application_requirements', 'application_requirement_events', 'documents',
        'document_requirement_satisfactions', 'document_events', 'verification_checks',
        'person_kyc_verifications', 'borrower_registration_verifications',
        'consent_grants', 'submission_packages', 'submission_events', 'outbox_events',
        'audit_events'
    ]
    LOOP
        EXECUTE format(
            'CREATE POLICY tenant_isolation ON %I USING (marketplace_id = nullif(current_setting(''app.current_marketplace_id'', true), '''')::uuid) WITH CHECK (marketplace_id = nullif(current_setting(''app.current_marketplace_id'', true), '''')::uuid)',
            table_name
        );
    END LOOP;
END
$rls$;

COMMIT;
