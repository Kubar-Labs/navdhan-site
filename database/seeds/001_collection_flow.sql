BEGIN;

SET LOCAL app.current_marketplace_id = '10000000-0000-0000-0000-000000000001';

INSERT INTO marketplaces (
    marketplace_id, code, legal_name, display_name, status, settings
) VALUES (
    '10000000-0000-0000-0000-000000000001',
    'navdhan',
    'NavDhan',
    'NavDhan',
    'active',
    '{}'::jsonb
)
ON CONFLICT (marketplace_id) DO UPDATE SET
    code = EXCLUDED.code,
    legal_name = EXCLUDED.legal_name,
    display_name = EXCLUDED.display_name,
    status = EXCLUDED.status,
    updated_at = now();

INSERT INTO loan_products (
    product_code, family, display_name, is_secured, min_amount, max_amount,
    currency, min_tenure_months, max_tenure_months, is_active
) VALUES (
    'business_loan', 'commercial', 'Business Loan', false, 500000.00,
    10000000.00, 'INR', 3, 12, true
)
ON CONFLICT (product_code) DO UPDATE SET
    family = EXCLUDED.family,
    display_name = EXCLUDED.display_name,
    is_secured = EXCLUDED.is_secured,
    min_amount = EXCLUDED.min_amount,
    max_amount = EXCLUDED.max_amount,
    currency = EXCLUDED.currency,
    min_tenure_months = EXCLUDED.min_tenure_months,
    max_tenure_months = EXCLUDED.max_tenure_months,
    is_active = EXCLUDED.is_active,
    updated_at = now();

INSERT INTO business_types (code, display_name, external_value, is_active, display_order)
VALUES
    ('trading', 'Trading', 'TRADING', true, 10),
    ('manufacturing', 'Manufacturing', 'MANUFACTURING', true, 20),
    ('services', 'Services', 'SERVICES', true, 30)
ON CONFLICT (code) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    external_value = EXCLUDED.external_value,
    is_active = EXCLUDED.is_active,
    display_order = EXCLUDED.display_order;

INSERT INTO employment_statuses (code, display_name, external_value, is_active, display_order)
VALUES
    ('self_employed', 'Self-employed', 'SELF_EMPLOYED', true, 10),
    ('salaried', 'Salaried', 'SALARIED', true, 20),
    ('other', 'Other', 'OTHER', true, 30)
ON CONFLICT (code) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    external_value = EXCLUDED.external_value,
    is_active = EXCLUDED.is_active,
    display_order = EXCLUDED.display_order;

INSERT INTO income_types (code, display_name, external_value, is_active, display_order)
VALUES
    ('business_income', 'Business income', 'BUSINESS_INCOME', true, 10),
    ('salary', 'Salary', 'SALARY', true, 20),
    ('other', 'Other', 'OTHER', true, 30)
ON CONFLICT (code) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    external_value = EXCLUDED.external_value,
    is_active = EXCLUDED.is_active,
    display_order = EXCLUDED.display_order;

INSERT INTO retention_classes (
    retention_class_code, display_name, retention_months, legal_basis, purge_pii_only
) VALUES
    ('kyc_regulatory', 'KYC regulatory records', 60, 'Applicable KYC record-retention obligations', true),
    ('financial', 'Application financial records', 60, 'Credit application and servicing obligations', false)
ON CONFLICT (retention_class_code) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    retention_months = EXCLUDED.retention_months,
    legal_basis = EXCLUDED.legal_basis,
    purge_pii_only = EXCLUDED.purge_pii_only;

INSERT INTO document_types (
    document_type_code, display_name, category, attaches_to, is_periodic,
    periodicity, is_multi_instance, allows_consolidated_file, max_size_bytes,
    max_page_count, retention_class_code, extraction_schema, is_active
) VALUES
    ('aadhaar_kyc', 'Aadhaar KYC', 'kyc', 'person', false, 'none', false, false, 10485760, 50, 'kyc_regulatory', '{}'::jsonb, true),
    ('aoa', 'Articles of Association', 'legal', 'entity', false, 'none', false, false, 10485760, 200, 'financial', '{}'::jsonb, true),
    ('balance_sheet', 'Balance Sheet', 'financial', 'entity', true, 'annual', true, true, 10485760, 200, 'financial', '{}'::jsonb, true),
    ('bank_statement', 'Bank Statement', 'banking', 'entity', true, 'monthly', true, true, 10485760, 500, 'financial', '{}'::jsonb, true),
    ('certificate_of_incorporation', 'Certificate of Incorporation', 'entity_proof', 'entity', false, 'none', false, false, 10485760, 50, 'financial', '{}'::jsonb, true),
    ('computation_of_income', 'Computation of Income', 'financial', 'entity', true, 'annual', true, true, 10485760, 200, 'financial', '{}'::jsonb, true),
    ('cibil_report', 'CIBIL Report', 'financial', 'person', false, 'none', false, false, 10485760, 100, 'financial', '{}'::jsonb, true),
    ('existing_loan_track', 'Existing Loan Track', 'obligation', 'facility', false, 'none', true, false, 10485760, 200, 'financial', '{}'::jsonb, true),
    ('entity_pan_card', 'Entity PAN Card', 'entity_proof', 'entity', false, 'none', false, false, 10485760, 20, 'kyc_regulatory', '{}'::jsonb, true),
    ('form_3cb', 'Form 3CB', 'tax', 'entity', true, 'annual', true, true, 10485760, 200, 'financial', '{}'::jsonb, true),
    ('form_3cd', 'Form 3CD', 'tax', 'entity', true, 'annual', true, true, 10485760, 200, 'financial', '{}'::jsonb, true),
    ('gst_certificate', 'GST Certificate', 'vintage', 'entity', false, 'none', true, false, 10485760, 50, 'financial', '{}'::jsonb, true),
    ('gstr_3b', 'GSTR-3B', 'tax', 'entity', true, 'monthly', true, true, 10485760, 500, 'financial', '{}'::jsonb, true),
    ('itr', 'Income Tax Return (incl. Balance Sheet, P&L, Computation of Income, Form 3CB, Form 3CD)', 'tax', 'entity', true, 'annual', true, true, 10485760, 200, 'financial', '{}'::jsonb, true),
    ('moa', 'Memorandum of Association', 'legal', 'entity', false, 'none', false, false, 10485760, 200, 'financial', '{}'::jsonb, true),
    ('own_house_proof', 'Own House Proof', 'premises', 'person', false, 'none', true, false, 10485760, 50, 'financial', '{}'::jsonb, true),
    ('pan_card', 'PAN Card', 'kyc', 'person', false, 'none', false, false, 10485760, 20, 'kyc_regulatory', '{}'::jsonb, true),
    ('partnership_deed', 'Partnership Deed', 'legal', 'entity', false, 'none', false, false, 10485760, 200, 'financial', '{}'::jsonb, true),
    ('profit_and_loss', 'Profit and Loss Statement', 'financial', 'entity', true, 'annual', true, true, 10485760, 200, 'financial', '{}'::jsonb, true),
    ('sanction_letter', 'Sanction Letter', 'obligation', 'facility', false, 'none', true, false, 10485760, 100, 'financial', '{}'::jsonb, true),
    ('shareholding_pattern', 'Shareholding Pattern', 'legal', 'entity', false, 'none', false, false, 10485760, 100, 'financial', '{}'::jsonb, true),
    ('trade_license', 'Trade License', 'vintage', 'entity', false, 'none', true, false, 10485760, 50, 'financial', '{}'::jsonb, true),
    ('vat_proof', 'VAT Proof', 'vintage', 'entity', false, 'none', true, false, 10485760, 50, 'financial', '{}'::jsonb, true)
ON CONFLICT (document_type_code) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    category = EXCLUDED.category,
    attaches_to = EXCLUDED.attaches_to,
    is_periodic = EXCLUDED.is_periodic,
    periodicity = EXCLUDED.periodicity,
    is_multi_instance = EXCLUDED.is_multi_instance,
    allows_consolidated_file = EXCLUDED.allows_consolidated_file,
    max_size_bytes = EXCLUDED.max_size_bytes,
    max_page_count = EXCLUDED.max_page_count,
    retention_class_code = EXCLUDED.retention_class_code,
    extraction_schema = EXCLUDED.extraction_schema,
    is_active = EXCLUDED.is_active,
    updated_at = now();

INSERT INTO document_type_mime_types (document_type_code, mime_type)
SELECT document_type_code, 'application/pdf'
FROM document_types
WHERE document_type_code IN (
    'aadhaar_kyc', 'aoa', 'balance_sheet', 'bank_statement',
    'certificate_of_incorporation', 'computation_of_income',
    'cibil_report', 'existing_loan_track', 'entity_pan_card', 'form_3cb', 'form_3cd', 'gst_certificate',
    'gstr_3b', 'itr', 'moa', 'own_house_proof', 'pan_card',
    'partnership_deed', 'profit_and_loss', 'sanction_letter',
    'shareholding_pattern', 'trade_license', 'vat_proof'
)
ON CONFLICT (document_type_code, mime_type) DO NOTHING;

INSERT INTO checklist_versions (
    checklist_version_id, name, version_no, product_code, constitution,
    lender_id, marketplace_id, status, effective_from, effective_to, published_by, published_at
) VALUES
    ('20000000-0000-0000-0000-000000000001', 'BL — Proprietorship', 1, 'business_loan', 'proprietorship', NULL, '10000000-0000-0000-0000-000000000001', 'active', DATE '2026-08-19', NULL, 'NavDhan Credit Policy', TIMESTAMPTZ '2026-08-19 00:00:00+00'),
    ('20000000-0000-0000-0000-000000000002', 'BL — Partnership', 1, 'business_loan', 'partnership', NULL, '10000000-0000-0000-0000-000000000001', 'active', DATE '2026-08-19', NULL, 'NavDhan Credit Policy', TIMESTAMPTZ '2026-08-19 00:00:00+00'),
    ('20000000-0000-0000-0000-000000000003', 'BL — Private Limited', 1, 'business_loan', 'private_limited', NULL, '10000000-0000-0000-0000-000000000001', 'active', DATE '2026-08-19', NULL, 'NavDhan Credit Policy', TIMESTAMPTZ '2026-08-19 00:00:00+00')
ON CONFLICT (checklist_version_id) DO UPDATE SET
    name = EXCLUDED.name,
    version_no = EXCLUDED.version_no,
    product_code = EXCLUDED.product_code,
    constitution = EXCLUDED.constitution,
    lender_id = EXCLUDED.lender_id,
    marketplace_id = EXCLUDED.marketplace_id,
    status = EXCLUDED.status,
    effective_from = EXCLUDED.effective_from,
    effective_to = EXCLUDED.effective_to,
    published_by = EXCLUDED.published_by,
    published_at = EXCLUDED.published_at,
    updated_at = now();

-- Requirements are stable policy rows. `vintage_proof` alternatives are OR-ed.
-- Annual rows cover the prior two fiscal years; monthly rows cover 12 months.
INSERT INTO document_requirements (
    requirement_id, checklist_version_id, document_type_code, attaches_to,
    party_role, obligation, blocks_submission, alt_group, condition,
    coverage_mode, lookback_months, fixed_period_start, min_count,
    display_order, notes
) VALUES
    -- The audited-financials annexures (Balance Sheet, P&L, Computation of
    -- Income, Form 3CB, Form 3CD) are not collected as separate documents --
    -- they must be part of the ITR return itself.
    -- Proprietorship
    ('30000000-0000-0000-0000-000000000301', '20000000-0000-0000-0000-000000000001', 'pan_card', 'person', 'applicant', 'mandatory', true, NULL, '{}'::jsonb, 'none', NULL, NULL, 1, 20, 'Applicant personal PAN'),
    ('30000000-0000-0000-0000-000000000302', '20000000-0000-0000-0000-000000000001', 'aadhaar_kyc', 'person', 'applicant', 'mandatory', true, NULL, '{}'::jsonb, 'none', NULL, NULL, 1, 21, 'Applicant Aadhaar KYC'),
    ('30000000-0000-0000-0000-000000000305', '20000000-0000-0000-0000-000000000001', 'cibil_report', 'person', 'applicant', 'mandatory', true, NULL, '{"primary_party_only":true}'::jsonb, 'none', NULL, NULL, 1, 22, 'Latest CIBIL report'),
    ('30000000-0000-0000-0000-000000000590', '20000000-0000-0000-0000-000000000001', 'pan_card', 'person', 'co_applicant', 'mandatory', true, NULL, '{"when_role_present":"co_applicant"}'::jsonb, 'none', NULL, NULL, 1, 30, 'Co-applicant personal PAN when present'),
    ('30000000-0000-0000-0000-000000000591', '20000000-0000-0000-0000-000000000001', 'aadhaar_kyc', 'person', 'co_applicant', 'mandatory', true, NULL, '{"when_role_present":"co_applicant"}'::jsonb, 'none', NULL, NULL, 1, 31, 'Co-applicant Aadhaar KYC when present'),
    ('30000000-0000-0000-0000-000000000306', '20000000-0000-0000-0000-000000000001', 'gst_certificate', 'entity', NULL, 'mandatory', true, 'vintage_proof', '{}'::jsonb, 'none', NULL, NULL, 1, 40, NULL),
    ('30000000-0000-0000-0000-000000000307', '20000000-0000-0000-0000-000000000001', 'vat_proof', 'entity', NULL, 'mandatory', true, 'vintage_proof', '{}'::jsonb, 'none', NULL, NULL, 1, 41, NULL),
    ('30000000-0000-0000-0000-000000000308', '20000000-0000-0000-0000-000000000001', 'trade_license', 'entity', NULL, 'mandatory', true, 'vintage_proof', '{}'::jsonb, 'none', NULL, NULL, 1, 42, NULL),
    ('30000000-0000-0000-0000-000000000309', '20000000-0000-0000-0000-000000000001', 'itr', 'entity', NULL, 'mandatory', true, NULL, '{}'::jsonb, 'fiscal_year', 24, NULL, 2, 50, 'Balance Sheet, P&L, Computation of Income, Form 3CB and Form 3CD must be part of the ITR return, not uploaded separately'),
    ('30000000-0000-0000-0000-000000000310', '20000000-0000-0000-0000-000000000001', 'bank_statement', 'entity', NULL, 'mandatory', true, NULL, '{}'::jsonb, 'month_range', 12, NULL, 1, 60, NULL),
    ('30000000-0000-0000-0000-000000000311', '20000000-0000-0000-0000-000000000001', 'gstr_3b', 'entity', NULL, 'mandatory', true, NULL, '{}'::jsonb, 'month_range', 12, NULL, 1, 70, NULL),
    ('30000000-0000-0000-0000-000000000312', '20000000-0000-0000-0000-000000000001', 'sanction_letter', 'facility', NULL, 'conditional', true, NULL, '{"has_active_credit_facilities":true}'::jsonb, 'per_facility', NULL, NULL, 1, 80, NULL),
    -- Partnership
    ('30000000-0000-0000-0000-000000000401', '20000000-0000-0000-0000-000000000002', 'entity_pan_card', 'entity', NULL, 'mandatory', true, NULL, '{"registration_kind":"entity_pan"}'::jsonb, 'none', NULL, NULL, 1, 10, 'Firm PAN'),
    ('30000000-0000-0000-0000-000000000402', '20000000-0000-0000-0000-000000000002', 'pan_card', 'person', 'applicant', 'mandatory', true, NULL, '{}'::jsonb, 'none', NULL, NULL, 1, 20, 'Applicant personal PAN'),
    ('30000000-0000-0000-0000-000000000403', '20000000-0000-0000-0000-000000000002', 'aadhaar_kyc', 'person', 'applicant', 'mandatory', true, NULL, '{}'::jsonb, 'none', NULL, NULL, 1, 21, 'Applicant Aadhaar KYC'),
    ('30000000-0000-0000-0000-000000000406', '20000000-0000-0000-0000-000000000002', 'cibil_report', 'person', 'applicant', 'mandatory', true, NULL, '{"primary_party_only":true}'::jsonb, 'none', NULL, NULL, 1, 22, 'Latest CIBIL report'),
    ('30000000-0000-0000-0000-000000000592', '20000000-0000-0000-0000-000000000002', 'pan_card', 'person', 'co_applicant', 'mandatory', true, NULL, '{"when_role_present":"co_applicant"}'::jsonb, 'none', NULL, NULL, 1, 30, 'Co-applicant partner personal PAN when present'),
    ('30000000-0000-0000-0000-000000000593', '20000000-0000-0000-0000-000000000002', 'aadhaar_kyc', 'person', 'co_applicant', 'mandatory', true, NULL, '{"when_role_present":"co_applicant"}'::jsonb, 'none', NULL, NULL, 1, 31, 'Co-applicant partner Aadhaar KYC when present'),
    ('30000000-0000-0000-0000-000000000407', '20000000-0000-0000-0000-000000000002', 'gst_certificate', 'entity', NULL, 'mandatory', true, 'vintage_proof', '{}'::jsonb, 'none', NULL, NULL, 1, 40, NULL),
    ('30000000-0000-0000-0000-000000000408', '20000000-0000-0000-0000-000000000002', 'vat_proof', 'entity', NULL, 'mandatory', true, 'vintage_proof', '{}'::jsonb, 'none', NULL, NULL, 1, 41, NULL),
    ('30000000-0000-0000-0000-000000000409', '20000000-0000-0000-0000-000000000002', 'trade_license', 'entity', NULL, 'mandatory', true, 'vintage_proof', '{}'::jsonb, 'none', NULL, NULL, 1, 42, NULL),
    ('30000000-0000-0000-0000-000000000410', '20000000-0000-0000-0000-000000000002', 'itr', 'entity', NULL, 'mandatory', true, NULL, '{}'::jsonb, 'fiscal_year', 24, NULL, 2, 50, 'Balance Sheet, P&L, Computation of Income, Form 3CB and Form 3CD must be part of the ITR return, not uploaded separately'),
    ('30000000-0000-0000-0000-000000000411', '20000000-0000-0000-0000-000000000002', 'bank_statement', 'entity', NULL, 'mandatory', true, NULL, '{}'::jsonb, 'month_range', 12, NULL, 1, 60, NULL),
    ('30000000-0000-0000-0000-000000000412', '20000000-0000-0000-0000-000000000002', 'gstr_3b', 'entity', NULL, 'mandatory', true, NULL, '{}'::jsonb, 'month_range', 12, NULL, 1, 70, NULL),
    ('30000000-0000-0000-0000-000000000413', '20000000-0000-0000-0000-000000000002', 'sanction_letter', 'facility', NULL, 'conditional', true, NULL, '{"has_active_credit_facilities":true}'::jsonb, 'per_facility', NULL, NULL, 1, 80, NULL),
    -- Private limited
    ('30000000-0000-0000-0000-000000000501', '20000000-0000-0000-0000-000000000003', 'entity_pan_card', 'entity', NULL, 'mandatory', true, NULL, '{"registration_kind":"entity_pan"}'::jsonb, 'none', NULL, NULL, 1, 10, 'Company PAN'),
    ('30000000-0000-0000-0000-000000000502', '20000000-0000-0000-0000-000000000003', 'pan_card', 'person', 'director', 'mandatory', true, NULL, '{}'::jsonb, 'none', NULL, NULL, 1, 20, 'Director personal PAN'),
    ('30000000-0000-0000-0000-000000000503', '20000000-0000-0000-0000-000000000003', 'aadhaar_kyc', 'person', 'director', 'mandatory', true, NULL, '{}'::jsonb, 'none', NULL, NULL, 1, 21, 'Director Aadhaar KYC'),
    ('30000000-0000-0000-0000-000000000504', '20000000-0000-0000-0000-000000000003', 'cibil_report', 'person', 'director', 'mandatory', true, NULL, '{"primary_party_only":true}'::jsonb, 'none', NULL, NULL, 1, 22, 'Latest CIBIL report'),
    ('30000000-0000-0000-0000-000000000505', '20000000-0000-0000-0000-000000000003', 'gst_certificate', 'entity', NULL, 'mandatory', true, 'vintage_proof', '{}'::jsonb, 'none', NULL, NULL, 1, 40, NULL),
    ('30000000-0000-0000-0000-000000000506', '20000000-0000-0000-0000-000000000003', 'vat_proof', 'entity', NULL, 'mandatory', true, 'vintage_proof', '{}'::jsonb, 'none', NULL, NULL, 1, 41, NULL),
    ('30000000-0000-0000-0000-000000000507', '20000000-0000-0000-0000-000000000003', 'trade_license', 'entity', NULL, 'mandatory', true, 'vintage_proof', '{}'::jsonb, 'none', NULL, NULL, 1, 42, NULL),
    ('30000000-0000-0000-0000-000000000508', '20000000-0000-0000-0000-000000000003', 'itr', 'entity', NULL, 'mandatory', true, NULL, '{}'::jsonb, 'fiscal_year', 24, NULL, 2, 50, 'Balance Sheet, P&L, Computation of Income, Form 3CB and Form 3CD must be part of the ITR return, not uploaded separately'),
    ('30000000-0000-0000-0000-000000000509', '20000000-0000-0000-0000-000000000003', 'bank_statement', 'entity', NULL, 'mandatory', true, NULL, '{}'::jsonb, 'month_range', 12, NULL, 1, 60, NULL),
    ('30000000-0000-0000-0000-000000000510', '20000000-0000-0000-0000-000000000003', 'gstr_3b', 'entity', NULL, 'mandatory', true, NULL, '{}'::jsonb, 'month_range', 12, NULL, 1, 70, 'Latest 12 months'),
    ('30000000-0000-0000-0000-000000000511', '20000000-0000-0000-0000-000000000003', 'sanction_letter', 'facility', NULL, 'conditional', true, NULL, '{"has_active_credit_facilities":true}'::jsonb, 'per_facility', NULL, NULL, 1, 80, NULL)
ON CONFLICT (requirement_id) DO UPDATE SET
    checklist_version_id = EXCLUDED.checklist_version_id,
    document_type_code = EXCLUDED.document_type_code,
    attaches_to = EXCLUDED.attaches_to,
    party_role = EXCLUDED.party_role,
    obligation = EXCLUDED.obligation,
    blocks_submission = EXCLUDED.blocks_submission,
    alt_group = EXCLUDED.alt_group,
    condition = EXCLUDED.condition,
    coverage_mode = EXCLUDED.coverage_mode,
    lookback_months = EXCLUDED.lookback_months,
    fixed_period_start = EXCLUDED.fixed_period_start,
    min_count = EXCLUDED.min_count,
    display_order = EXCLUDED.display_order,
    notes = EXCLUDED.notes;

INSERT INTO destinations (
    destination_id, code, display_name, destination_type, lender_id, payload_format
) VALUES (
    '40000000-0000-0000-0000-000000000001',
    'manual_dashboard',
    'Manual Ops Dashboard',
    'manual_dashboard',
    NULL,
    'ndp_v1'
)
ON CONFLICT (destination_id) DO UPDATE SET
    code = EXCLUDED.code,
    display_name = EXCLUDED.display_name,
    destination_type = EXCLUDED.destination_type,
    lender_id = EXCLUDED.lender_id,
    payload_format = EXCLUDED.payload_format,
    updated_at = now();

INSERT INTO consent_purposes (
    purpose_code, display_name, notice_text, notice_version, is_mandatory,
    retention_months, effective_from, effective_to
) VALUES
    ('privacy_policy', 'I agree to the Privacy Policy', 'I agree to the Privacy Policy', 1, true, 60, DATE '2025-04-01', NULL),
    ('terms_of_use', 'I agree to the Terms of Use', 'I agree to the Terms of Use', 1, true, 60, DATE '2025-04-01', NULL),
    ('credit_bureau_check', 'I consent to a credit bureau check', 'I consent to a credit bureau check', 1, true, 60, DATE '2025-04-01', NULL),
    ('communications', 'I consent to receive communication from NavDhan', 'I consent to receive communication from NavDhan', 1, false, 24, DATE '2025-04-01', NULL),
    ('gst_verification', 'I consent to sharing my GST registration details', 'I consent to sharing my GST registration details', 1, false, 60, DATE '2025-04-01', NULL)
ON CONFLICT (purpose_code) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    notice_text = EXCLUDED.notice_text,
    notice_version = EXCLUDED.notice_version,
    is_mandatory = EXCLUDED.is_mandatory,
    retention_months = EXCLUDED.retention_months,
    effective_from = EXCLUDED.effective_from,
    effective_to = EXCLUDED.effective_to;

COMMIT;
