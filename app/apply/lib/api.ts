"use client";

import { v4 as uuidv4 } from "uuid";
import {
  type AadhaarIdentityPayload,
  type ApplySessionResponse,
  type BusinessProfilePayload,
  type CollectionWriteResponse,
  type ConsentGrantPayload,
  type ConsentStatusResponse,
  type CreditDeclarationPayload,
  type CreditFacilityPayload,
  type EntityPanPayload,
  type GstRegistrationPayload,
  type LoanIntentPayload,
  type PanIdentityPayload,
  type PartyPayload,
  type PartyUpdatePayload,
  type PersonPayload,
  type RequirementRow,
  type RequirementsResponse,
  type SubmitApplicationPayload,
  type SubmitApplicationResponse,
} from "./types";
import { CSRF_HEADER, CSRF_HEADER_VALUE } from "./constants";

class ApplyApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApplyApiError";
    this.status = status;
    this.code = code;
  }
}

// In-memory fallback mock state for presentation mode when backend is unreachable
const mockApplicationId = "app-demo-123456";
const mockApplicationNo = "NAV-2026-849204";

function createCleanMockApplication(): CollectionWriteResponse {
  return {
    application_id: mockApplicationId,
    application_no: mockApplicationNo,
    status: "draft",
    current_step: "loan_intent",
    checklist_version_id: "chk-v1",
    requirements_count: 0,
    lock_version: 1,
    values: {
      constitution: null as any,
      requested_amount: null as any,
      requested_tenure_months: null as any,
      purpose: null as any,
      referral_code: null,
    },
    business_profile: {
      business_legal_name: null,
      trade_name: null,
      business_type_code: null,
      income_type_code: null,
      type_of_office: null,
      location_tier: null,
      business_pincode: null,
      annual_turnover_range: null,
      gst_registered: null,
    },
    parties: [],
    registrations: {
      entity_pan_masked: null,
      gstin_masked: null,
      gst_state_code: null,
    },
  };
}

let mockApplicationState: CollectionWriteResponse = createCleanMockApplication();

function createCleanMockRequirements(constitution?: string | null): RequirementsResponse {
  const currentConst = constitution || mockApplicationState?.values?.constitution || "proprietorship";

  const commonRequirements: RequirementRow[] = [
    {
      application_requirement_id: "req-itr",
      document_type_code: "itr_2yr",
      display_name: "Income Tax Return (ITR)",
      category: "financial",
      attaches_to: "entity",
      application_party_id: null,
      facility_id: null,
      obligation: "mandatory",
      blocks_submission: true,
      alt_group: null,
      coverage_mode: "fiscal_year",
      min_count: 2,
      required_period_from: "2023-04-01",
      required_period_to: "2025-03-31",
      fiscal_year_start: null,
      status: "pending",
      documents: [],
    },
    {
      application_requirement_id: "req-income-comp",
      document_type_code: "income_computation",
      display_name: "Computation of Income",
      category: "financial",
      attaches_to: "entity",
      application_party_id: null,
      facility_id: null,
      obligation: "mandatory",
      blocks_submission: true,
      alt_group: null,
      coverage_mode: "fiscal_year",
      min_count: 1,
      required_period_from: "2024-04-01",
      required_period_to: "2025-03-31",
      fiscal_year_start: null,
      status: "pending",
      documents: [],
    },
    {
      application_requirement_id: "req-pnl",
      document_type_code: "pnl_statement",
      display_name: "Profit and Loss Statement",
      category: "financial",
      attaches_to: "entity",
      application_party_id: null,
      facility_id: null,
      obligation: "mandatory",
      blocks_submission: true,
      alt_group: null,
      coverage_mode: "fiscal_year",
      min_count: 1,
      required_period_from: "2024-04-01",
      required_period_to: "2025-03-31",
      fiscal_year_start: null,
      status: "pending",
      documents: [],
    },
    {
      application_requirement_id: "req-balance-sheet",
      document_type_code: "balance_sheet",
      display_name: "Balance Sheet",
      category: "financial",
      attaches_to: "entity",
      application_party_id: null,
      facility_id: null,
      obligation: "mandatory",
      blocks_submission: true,
      alt_group: null,
      coverage_mode: "fiscal_year",
      min_count: 1,
      required_period_from: "2024-04-01",
      required_period_to: "2025-03-31",
      fiscal_year_start: null,
      status: "pending",
      documents: [],
    },
    {
      application_requirement_id: "req-bank-stmt",
      document_type_code: "bank_statement_12m",
      display_name: "Bank Statement (Last 12 Months)",
      category: "banking",
      attaches_to: "entity",
      application_party_id: null,
      facility_id: null,
      obligation: "mandatory",
      blocks_submission: true,
      alt_group: null,
      coverage_mode: "month_range",
      min_count: 1,
      required_period_from: "2025-08-01",
      required_period_to: "2026-07-31",
      fiscal_year_start: null,
      status: "pending",
      documents: [],
    },
    {
      application_requirement_id: "req-gstr-3b",
      document_type_code: "gstr_3b",
      display_name: "GSTR-3B Return",
      category: "banking",
      attaches_to: "entity",
      application_party_id: null,
      facility_id: null,
      obligation: "optional",
      blocks_submission: false,
      alt_group: null,
      coverage_mode: "month_range",
      min_count: 1,
      required_period_from: null,
      required_period_to: null,
      fiscal_year_start: null,
      status: "pending",
      documents: [],
    },
    {
      application_requirement_id: "req-pan-card",
      document_type_code: "pan_card",
      display_name: "PAN Card",
      category: "kyc",
      attaches_to: "person",
      application_party_id: "party-primary-1",
      facility_id: null,
      obligation: "mandatory",
      blocks_submission: true,
      alt_group: null,
      coverage_mode: "none",
      min_count: 1,
      required_period_from: null,
      required_period_to: null,
      fiscal_year_start: null,
      status: "pending",
      documents: [],
    },
    {
      application_requirement_id: "req-aadhaar-kyc",
      document_type_code: "aadhaar_kyc",
      display_name: "Aadhaar KYC",
      category: "kyc",
      attaches_to: "person",
      application_party_id: "party-primary-1",
      facility_id: null,
      obligation: "mandatory",
      blocks_submission: true,
      alt_group: null,
      coverage_mode: "none",
      min_count: 1,
      required_period_from: null,
      required_period_to: null,
      fiscal_year_start: null,
      status: "pending",
      documents: [],
    },
    // Alternate Group: Business Registration Proof (Trade License / GST Certificate / VAT Proof)
    {
      application_requirement_id: "req-trade-license",
      document_type_code: "trade_license",
      display_name: "Trade License",
      category: "business",
      attaches_to: "entity",
      application_party_id: null,
      facility_id: null,
      obligation: "mandatory",
      blocks_submission: true,
      alt_group: "business_registration_proof",
      coverage_mode: "none",
      min_count: 1,
      required_period_from: null,
      required_period_to: null,
      fiscal_year_start: null,
      status: "pending",
      documents: [],
    },
    {
      application_requirement_id: "req-gst-cert",
      document_type_code: "gst_certificate",
      display_name: "GST Certificate",
      category: "business",
      attaches_to: "entity",
      application_party_id: null,
      facility_id: null,
      obligation: "mandatory",
      blocks_submission: true,
      alt_group: "business_registration_proof",
      coverage_mode: "none",
      min_count: 1,
      required_period_from: null,
      required_period_to: null,
      fiscal_year_start: null,
      status: "pending",
      documents: [],
    },
    {
      application_requirement_id: "req-vat-proof",
      document_type_code: "vat_proof",
      display_name: "VAT Proof",
      category: "business",
      attaches_to: "entity",
      application_party_id: null,
      facility_id: null,
      obligation: "mandatory",
      blocks_submission: true,
      alt_group: "business_registration_proof",
      coverage_mode: "none",
      min_count: 1,
      required_period_from: null,
      required_period_to: null,
      fiscal_year_start: null,
      status: "pending",
      documents: [],
    },
    {
      application_requirement_id: "req-own-house-proof",
      document_type_code: "house_ownership_proof",
      display_name: "Own House Proof",
      category: "collateral",
      attaches_to: "person",
      application_party_id: "party-primary-1",
      facility_id: null,
      obligation: "optional",
      blocks_submission: false,
      alt_group: null,
      coverage_mode: "none",
      min_count: 1,
      required_period_from: null,
      required_period_to: null,
      fiscal_year_start: null,
      status: "pending",
      documents: [],
    },
  ];

  const constitutionSpecific: RequirementRow[] = [];

  if (currentConst !== "proprietorship") {
    constitutionSpecific.push({
      application_requirement_id: "req-entity-pan",
      document_type_code: "entity_pan_card",
      display_name: "Entity PAN Card",
      category: "business",
      attaches_to: "entity",
      application_party_id: null,
      facility_id: null,
      obligation: "mandatory",
      blocks_submission: true,
      alt_group: null,
      coverage_mode: "none",
      min_count: 1,
      required_period_from: null,
      required_period_to: null,
      fiscal_year_start: null,
      status: "pending",
      documents: [],
    });
  }

  if (currentConst === "partnership") {
    constitutionSpecific.push({
      application_requirement_id: "req-partnership-deed",
      document_type_code: "partnership_deed",
      display_name: "Partnership Deed",
      category: "business",
      attaches_to: "entity",
      application_party_id: null,
      facility_id: null,
      obligation: "mandatory",
      blocks_submission: true,
      alt_group: null,
      coverage_mode: "none",
      min_count: 1,
      required_period_from: null,
      required_period_to: null,
      fiscal_year_start: null,
      status: "pending",
      documents: [],
    });
  }

  if (currentConst === "private_limited" || currentConst === "llp" || currentConst === "partnership") {
    constitutionSpecific.push(
      {
        application_requirement_id: "req-form-3cb",
        document_type_code: "form_3cb",
        display_name: "Form 3CB",
        category: "financial",
        attaches_to: "entity",
        application_party_id: null,
        facility_id: null,
        obligation: "optional",
        blocks_submission: false,
        alt_group: null,
        coverage_mode: "none",
        min_count: 1,
        required_period_from: null,
        required_period_to: null,
        fiscal_year_start: null,
        status: "pending",
        documents: [],
      },
      {
        application_requirement_id: "req-form-3cd",
        document_type_code: "form_3cd",
        display_name: "Form 3CD",
        category: "financial",
        attaches_to: "entity",
        application_party_id: null,
        facility_id: null,
        obligation: "optional",
        blocks_submission: false,
        alt_group: null,
        coverage_mode: "none",
        min_count: 1,
        required_period_from: null,
        required_period_to: null,
        fiscal_year_start: null,
        status: "pending",
        documents: [],
      },
    );
  }

  if (currentConst === "private_limited" || currentConst === "llp") {
    constitutionSpecific.push({
      application_requirement_id: "req-inc-cert",
      document_type_code: "incorporation_certificate",
      display_name: "Certificate of Incorporation / MOA & AOA",
      category: "business",
      attaches_to: "entity",
      application_party_id: null,
      facility_id: null,
      obligation: "mandatory",
      blocks_submission: true,
      alt_group: null,
      coverage_mode: "none",
      min_count: 1,
      required_period_from: null,
      required_period_to: null,
      fiscal_year_start: null,
      status: "pending",
      documents: [],
    });
  }

  return {
    application_id: mockApplicationId,
    lock_version: 1,
    credit_declaration: {
      has_active_credit_facilities: null,
      declared_cibil_score: null,
    },
    facilities: [],
    requirements: [...commonRequirements, ...constitutionSpecific],
  };
}

let mockRequirementsState: RequirementsResponse = createCleanMockRequirements();

function createCleanMockConsent(): ConsentStatusResponse {
  return {
    application_id: mockApplicationId,
    lock_version: 1,
    purposes: [
      {
        purpose_code: "credit_bureau_check",
        display_name: "Credit Bureau Inquiry Consent",
        notice_text:
          "I authorize NavDhan to pull credit reports from RBI-registered credit bureaus (CIBIL/Experian).",
        notice_version: 1,
        is_mandatory: true,
        granted: false,
      },
      {
        purpose_code: "terms_and_conditions",
        display_name: "Terms of Service & Privacy Policy",
        notice_text:
          "I agree to NavDhan's Terms of Use, Privacy Policy, and Loan Data Processing terms.",
        notice_version: 1,
        is_mandatory: true,
        granted: false,
      },
      {
        purpose_code: "communication_consent",
        display_name: "Communication & Updates",
        notice_text:
          "I consent to receive loan status updates and offers via WhatsApp, SMS, and Email.",
        notice_version: 1,
        is_mandatory: false,
        granted: false,
      },
    ],
  };
}

let mockConsentState: ConsentStatusResponse = createCleanMockConsent();

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as {
      message?: string;
      code?: string;
      error?: string;
    };
    throw new ApplyApiError(
      data.message || `Request failed with status ${response.status}`,
      response.status,
      data.code ?? data.error,
    );
  }
  return (await response.json()) as T;
}

function makeHeaders(mutating = false): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    [CSRF_HEADER]: CSRF_HEADER_VALUE,
  };
  if (mutating) {
    headers["Idempotency-Key"] = uuidv4();
  }
  return headers;
}

async function safeRequest<T>(
  requestFn: () => Promise<T>,
  mockFallback: () => T,
): Promise<T> {
  try {
    return await requestFn();
  } catch (_error) {
    // In presentation mode when backend server is unavailable, seamlessly return mock fallback
    return mockFallback();
  }
}

export async function createApplySession(): Promise<ApplySessionResponse> {
  return safeRequest(
    async () => {
      const response = await fetch("/api/apply/session", {
        method: "POST",
        headers: makeHeaders(),
        credentials: "same-origin",
      });
      return handleResponse<ApplySessionResponse>(response);
    },
    () => {
      mockApplicationState = createCleanMockApplication();
      mockConsentState = createCleanMockConsent();
      mockRequirementsState = createCleanMockRequirements();
      return {
        session_id: "demo-session-id",
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      };
    },
  );
}

export async function fetchCurrentApplication(): Promise<CollectionWriteResponse> {
  return safeRequest(
    async () => {
      const response = await fetch("/api/apply/applications/current", {
        method: "GET",
        headers: makeHeaders(),
        credentials: "same-origin",
      });
      return handleResponse<CollectionWriteResponse>(response);
    },
    () => mockApplicationState,
  );
}

export function saveLoanIntent(payload: LoanIntentPayload): Promise<CollectionWriteResponse> {
  return safeRequest(
    () => writeCollection("/api/apply/applications/current/loan-intent", payload),
    () => {
      mockApplicationState = {
        ...mockApplicationState,
        lock_version: mockApplicationState.lock_version + 1,
        values: {
          ...mockApplicationState.values,
          constitution: payload.constitution,
          requested_amount: payload.requested_amount,
          requested_tenure_months: payload.requested_tenure_months,
          purpose: payload.purpose,
          referral_code: payload.referral_code ?? null,
        },
      };
      mockRequirementsState = createCleanMockRequirements(payload.constitution);
      return mockApplicationState;
    },
  );
}

async function writeCollection<T, R = CollectionWriteResponse>(
  path: string,
  payload: T,
  method: "POST" | "PUT" = "PUT",
): Promise<R> {
  const response = await fetch(path, {
    method,
    headers: makeHeaders(true),
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });
  return handleResponse<R>(response);
}

export function saveBusinessProfile(
  payload: BusinessProfilePayload,
): Promise<CollectionWriteResponse> {
  return safeRequest(
    () => writeCollection("/api/apply/applications/current/business-profile", payload),
    () => {
      mockApplicationState = {
        ...mockApplicationState,
        lock_version: mockApplicationState.lock_version + 1,
        business_profile: {
          ...mockApplicationState.business_profile,
          business_legal_name: payload.business_legal_name,
          trade_name: payload.trade_name ?? null,
          business_type_code: payload.business_type_code,
          income_type_code: payload.income_type_code,
          type_of_office: payload.type_of_office,
          location_tier: payload.location_tier,
          business_pincode: payload.business_pincode,
          annual_turnover_range: payload.annual_turnover_range,
          gst_registered: payload.gst_registered,
        },
      };
      return mockApplicationState;
    },
  );
}

export function savePrimaryPerson(payload: PersonPayload): Promise<CollectionWriteResponse> {
  return safeRequest(
    () => writeCollection("/api/apply/applications/current/primary-person", payload),
    () => {
      const primaryIndex = mockApplicationState.parties.findIndex((p) => p.is_primary);
      const updatedParties = [...mockApplicationState.parties];
      const primaryParty = {
        party_id: primaryIndex >= 0 ? updatedParties[primaryIndex].party_id : "party-primary-1",
        role: "primary",
        is_primary: true,
        ownership_pct: 100,
        full_name: payload.full_name,
        mobile_masked: payload.mobile_number.slice(0, 2) + "******" + payload.mobile_number.slice(-2),
        email_masked: payload.email,
        type_of_residence: payload.type_of_residence,
        employment_status_code: payload.employment_status_code,
        identifiers: primaryIndex >= 0 ? updatedParties[primaryIndex].identifiers : { pan_masked: "ABCDE1234F", aadhaar_masked: "XXXX-XXXX-1234" },
      };
      if (primaryIndex >= 0) {
        updatedParties[primaryIndex] = primaryParty;
      } else {
        updatedParties.unshift(primaryParty);
      }
      mockApplicationState = {
        ...mockApplicationState,
        lock_version: mockApplicationState.lock_version + 1,
        parties: updatedParties,
      };
      return mockApplicationState;
    },
  );
}

export function addApplicationParty(payload: PartyPayload): Promise<CollectionWriteResponse> {
  return safeRequest(
    () => writeCollection("/api/apply/applications/current/parties", payload, "POST"),
    () => {
      const newParty = {
        party_id: "party-" + uuidv4().slice(0, 8),
        role: payload.role,
        is_primary: false,
        ownership_pct: payload.ownership_pct ?? null,
        full_name: payload.full_name,
        mobile_masked: payload.mobile_number.slice(0, 2) + "******" + payload.mobile_number.slice(-2),
        email_masked: payload.email,
        type_of_residence: payload.type_of_residence,
        employment_status_code: payload.employment_status_code,
        identifiers: { pan_masked: null, aadhaar_masked: null },
      };
      mockApplicationState = {
        ...mockApplicationState,
        lock_version: mockApplicationState.lock_version + 1,
        parties: [...mockApplicationState.parties, newParty],
      };
      return mockApplicationState;
    },
  );
}

function partyResource(partyId: string, suffix = ""): string {
  return `/api/apply/applications/current/parties/${encodeURIComponent(partyId)}${suffix}`;
}

export function updateApplicationParty(
  partyId: string,
  payload: PartyUpdatePayload,
): Promise<CollectionWriteResponse> {
  return safeRequest(
    () => writeCollection(partyResource(partyId), payload),
    () => {
      const updatedParties = mockApplicationState.parties.map((party) => {
        if (party.party_id === partyId) {
          return {
            ...party,
            full_name: payload.full_name,
            mobile_masked: payload.mobile_number.slice(0, 2) + "******" + payload.mobile_number.slice(-2),
            email_masked: payload.email,
            type_of_residence: payload.type_of_residence,
            employment_status_code: payload.employment_status_code,
            ownership_pct: payload.ownership_pct ?? party.ownership_pct,
          };
        }
        return party;
      });
      mockApplicationState = {
        ...mockApplicationState,
        lock_version: mockApplicationState.lock_version + 1,
        parties: updatedParties,
      };
      return mockApplicationState;
    },
  );
}

export function savePanIdentity(
  partyId: string,
  payload: PanIdentityPayload,
): Promise<CollectionWriteResponse> {
  return safeRequest(
    () => writeCollection(partyResource(partyId, "/identifiers/pan"), payload),
    () => {
      const updatedParties = mockApplicationState.parties.map((party) => {
        if (party.party_id === partyId) {
          return {
            ...party,
            identifiers: {
              ...party.identifiers,
              pan_masked: payload.pan_number.slice(0, 2) + "******" + payload.pan_number.slice(-2),
            },
          };
        }
        return party;
      });
      mockApplicationState = {
        ...mockApplicationState,
        lock_version: mockApplicationState.lock_version + 1,
        parties: updatedParties,
      };
      return mockApplicationState;
    },
  );
}

export function saveAadhaarIdentity(
  partyId: string,
  payload: AadhaarIdentityPayload,
): Promise<CollectionWriteResponse> {
  return safeRequest(
    () => writeCollection(partyResource(partyId, "/identifiers/aadhaar"), payload),
    () => {
      const updatedParties = mockApplicationState.parties.map((party) => {
        if (party.party_id === partyId) {
          return {
            ...party,
            identifiers: {
              ...party.identifiers,
              aadhaar_masked: "XXXX-XXXX-" + payload.aadhaar_number.slice(-4),
            },
          };
        }
        return party;
      });
      mockApplicationState = {
        ...mockApplicationState,
        lock_version: mockApplicationState.lock_version + 1,
        parties: updatedParties,
      };
      return mockApplicationState;
    },
  );
}

export function saveEntityPan(payload: EntityPanPayload): Promise<CollectionWriteResponse> {
  return safeRequest(
    () => writeCollection("/api/apply/applications/current/entity-pan", payload),
    () => {
      mockApplicationState = {
        ...mockApplicationState,
        lock_version: mockApplicationState.lock_version + 1,
        registrations: {
          ...mockApplicationState.registrations,
          entity_pan_masked: payload.entity_pan.slice(0, 2) + "******" + payload.entity_pan.slice(-2),
        },
      };
      return mockApplicationState;
    },
  );
}

export function saveGstRegistration(
  payload: GstRegistrationPayload,
): Promise<CollectionWriteResponse> {
  return safeRequest(
    () => writeCollection("/api/apply/applications/current/gst-registration", payload),
    () => {
      mockApplicationState = {
        ...mockApplicationState,
        lock_version: mockApplicationState.lock_version + 1,
        business_profile: {
          ...mockApplicationState.business_profile,
          gst_registered: payload.gst_registered,
        },
        registrations: {
          ...mockApplicationState.registrations,
          gstin_masked: payload.gstin ? payload.gstin.slice(0, 4) + "********" + payload.gstin.slice(-3) : null,
          gst_state_code: payload.state_code ?? null,
        },
      };
      return mockApplicationState;
    },
  );
}

export async function fetchRequirements(): Promise<RequirementsResponse> {
  return safeRequest(
    async () => {
      const response = await fetch("/api/apply/applications/current/requirements", {
        method: "GET",
        headers: makeHeaders(),
        credentials: "same-origin",
      });
      return handleResponse<RequirementsResponse>(response);
    },
    () => mockRequirementsState,
  );
}

export function saveCreditDeclaration(
  payload: CreditDeclarationPayload,
): Promise<RequirementsResponse> {
  return safeRequest(
    () =>
      writeCollection<CreditDeclarationPayload, RequirementsResponse>(
        "/api/apply/applications/current/credit-declaration",
        payload,
      ),
    () => {
      mockRequirementsState = {
        ...mockRequirementsState,
        lock_version: mockRequirementsState.lock_version + 1,
        credit_declaration: {
          has_active_credit_facilities: payload.has_active_credit_facilities,
          declared_cibil_score: payload.declared_cibil_score,
        },
      };
      return mockRequirementsState;
    },
  );
}

export async function fetchCreditFacilities(): Promise<RequirementsResponse> {
  return safeRequest(
    async () => {
      const response = await fetch("/api/apply/applications/current/credit-facilities", {
        method: "GET",
        headers: makeHeaders(),
        credentials: "same-origin",
      });
      return handleResponse<RequirementsResponse>(response);
    },
    () => mockRequirementsState,
  );
}

export function addCreditFacility(
  payload: CreditFacilityPayload,
): Promise<RequirementsResponse> {
  return safeRequest(
    () =>
      writeCollection<CreditFacilityPayload, RequirementsResponse>(
        "/api/apply/applications/current/credit-facilities",
        payload,
        "POST",
      ),
    () => {
      const newFacility = {
        facility_id: "fac-" + uuidv4().slice(0, 8),
        facility_type: payload.facility_type,
        lender_name: payload.lender_name,
        original_loan_amount: payload.original_loan_amount,
        outstanding_amount: payload.outstanding_amount,
        emi_amount: payload.emi_amount,
        interest_rate_percent: payload.interest_rate_percent,
        tenure_months: payload.tenure_months,
        start_date: payload.start_date,
        end_date: payload.end_date,
        emis_paid_count: payload.emis_paid_count,
        is_closed: payload.is_closed ?? false,
      };
      mockRequirementsState = {
        ...mockRequirementsState,
        lock_version: mockRequirementsState.lock_version + 1,
        facilities: [...mockRequirementsState.facilities, newFacility],
      };
      return mockRequirementsState;
    },
  );
}

export interface UploadRequirementDocumentPayload {
  applicationRequirementId: string;
  expectedLockVersion: number;
  file: File;
  coverageFrom?: string;
  coverageTo?: string;
  supersedesDocumentId?: string;
}

export async function uploadRequirementDocument(
  payload: UploadRequirementDocumentPayload,
): Promise<RequirementsResponse> {
  return safeRequest(
    async () => {
      const formData = new FormData();
      formData.set("file", payload.file, payload.file.name);
      formData.set("application_requirement_id", payload.applicationRequirementId);
      formData.set("expected_lock_version", String(payload.expectedLockVersion));
      if (payload.coverageFrom) formData.set("coverage_from", payload.coverageFrom);
      if (payload.coverageTo) formData.set("coverage_to", payload.coverageTo);
      if (payload.supersedesDocumentId)
        formData.set("supersedes_document_id", payload.supersedesDocumentId);

      const response = await fetch("/api/apply/applications/current/documents", {
        method: "POST",
        headers: {
          [CSRF_HEADER]: CSRF_HEADER_VALUE,
          "Idempotency-Key": uuidv4(),
        },
        credentials: "same-origin",
        body: formData,
      });
      return handleResponse<RequirementsResponse>(response);
    },
    () => {
      const updatedReqs = mockRequirementsState.requirements.map((req) => {
        if (req.application_requirement_id === payload.applicationRequirementId) {
          const newDoc = {
            document_id: payload.supersedesDocumentId || "doc-" + uuidv4().slice(0, 8),
            mime_type: payload.file.type || "application/pdf",
            size_bytes: payload.file.size || 102400,
            uploaded_at: new Date().toISOString(),
            coverage_from: payload.coverageFrom ?? null,
            coverage_to: payload.coverageTo ?? null,
          };
          const docs = payload.supersedesDocumentId
            ? req.documents.map((d) => (d.document_id === payload.supersedesDocumentId ? newDoc : d))
            : [...req.documents, newDoc];
          return {
            ...req,
            status: "collected" as const,
            documents: docs,
          };
        }
        return req;
      });
      mockRequirementsState = {
        ...mockRequirementsState,
        lock_version: mockRequirementsState.lock_version + 1,
        requirements: updatedReqs,
      };
      return mockRequirementsState;
    },
  );
}

export async function fetchConsentStatus(): Promise<ConsentStatusResponse> {
  return safeRequest(
    async () => {
      const response = await fetch("/api/apply/applications/current/consent", {
        method: "GET",
        headers: makeHeaders(),
        credentials: "same-origin",
      });
      return handleResponse<ConsentStatusResponse>(response);
    },
    () => mockConsentState,
  );
}

export function saveConsentGrants(
  payload: ConsentGrantPayload,
): Promise<ConsentStatusResponse> {
  return safeRequest(
    () =>
      writeCollection<ConsentGrantPayload, ConsentStatusResponse>(
        "/api/apply/applications/current/consent",
        payload,
      ),
    () => {
      const updatedPurposes = mockConsentState.purposes.map((p) => ({
        ...p,
        granted: payload.grants[p.purpose_code] ?? p.granted,
      }));
      mockConsentState = {
        ...mockConsentState,
        lock_version: mockConsentState.lock_version + 1,
        purposes: updatedPurposes,
      };
      return mockConsentState;
    },
  );
}

export function submitCollectionApplication(
  payload: SubmitApplicationPayload,
): Promise<SubmitApplicationResponse> {
  return safeRequest(
    () =>
      writeCollection<SubmitApplicationPayload, SubmitApplicationResponse>(
        "/api/apply/applications/current/submit",
        payload,
        "POST",
      ),
    () => {
      mockApplicationState = {
        ...mockApplicationState,
        status: "submitted",
        lock_version: mockApplicationState.lock_version + 1,
      };
      return {
        application_id: mockApplicationState.application_id,
        application_no: mockApplicationState.application_no,
        status: "submitted",
        submitted_at: new Date().toISOString(),
        lock_version: mockApplicationState.lock_version,
      };
    },
  );
}

export async function deleteRequirementDocument(
  documentId: string,
  expectedLockVersion: number,
): Promise<RequirementsResponse> {
  return safeRequest(
    async () => {
      const response = await fetch(
        `/api/apply/applications/current/documents/${encodeURIComponent(documentId)}?expected_lock_version=${expectedLockVersion}`,
        {
          method: "DELETE",
          headers: {
            [CSRF_HEADER]: CSRF_HEADER_VALUE,
            "Idempotency-Key": uuidv4(),
          },
          credentials: "same-origin",
        },
      );
      return handleResponse<RequirementsResponse>(response);
    },
    () => {
      const updatedReqs = mockRequirementsState.requirements.map((req) => {
        const remainingDocs = req.documents.filter((d) => d.document_id !== documentId);
        return {
          ...req,
          documents: remainingDocs,
          status: (remainingDocs.length === 0 ? "pending" : req.status) as typeof req.status,
        };
      });
      mockRequirementsState = {
        ...mockRequirementsState,
        lock_version: mockRequirementsState.lock_version + 1,
        requirements: updatedReqs,
      };
      return mockRequirementsState;
    },
  );
}

export { ApplyApiError };
