/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  createApplySession: vi.fn(),
  fetchCurrentApplication: vi.fn(),
  saveLoanIntent: vi.fn(),
  saveBusinessProfile: vi.fn(),
  savePrimaryPerson: vi.fn(),
  addApplicationParty: vi.fn(),
  updateApplicationParty: vi.fn(),
  savePanIdentity: vi.fn(),
  saveAadhaarIdentity: vi.fn(),
  saveEntityPan: vi.fn(),
  saveGstRegistration: vi.fn(),
  fetchRequirements: vi.fn(),
  uploadRequirementDocument: vi.fn(),
  deleteRequirementDocument: vi.fn(),
  saveCreditDeclaration: vi.fn(),
  addCreditFacility: vi.fn(),
}));

vi.mock("@/app/apply/lib/api", () => ({
  ...api,
  ApplyApiError: class ApplyApiError extends Error {
    constructor(
      message: string,
      public status: number,
      public code?: string,
    ) {
      super(message);
    }
  },
}));

import { WizardShell } from "./WizardShell";
import type { CollectionWriteResponse, RequirementsResponse } from "@/app/apply/lib/types";

const steps = [
  { id: "loan_intent" as const, title: "Loan intent" },
  { id: "personal_contact" as const, title: "Personal contact" },
  { id: "aadhaar_verification" as const, title: "Aadhaar verification" },
  { id: "pan_verification" as const, title: "PAN verification" },
  { id: "gst_verification" as const, title: "GST verification" },
  { id: "itr_upload" as const, title: "Documents" },
];

// Resumes straight to the itr_upload step: business profile, primary
// party's KYC, and (non-GST) registration are all already complete.
function completeSnapshot(): CollectionWriteResponse {
  return {
    application_id: "10000000-0000-4000-8000-000000000001",
    application_no: "ND-2026-0001",
    status: "in_progress",
    current_step: "business_profile",
    checklist_version_id: "20000000-0000-4000-8000-000000000001",
    requirements_count: 14,
    lock_version: 6,
    values: {
      constitution: "proprietorship",
      requested_amount: 500_000,
      requested_tenure_months: 6,
      purpose: "working_capital",
      referral_code: null,
    },
    business_profile: {
      business_legal_name: "NavDhan Traders",
      trade_name: null,
      business_type_code: "trading",
      income_type_code: "business_income",
      type_of_office: "owned_office",
      location_tier: "tier1",
      business_pincode: "560001",
      annual_turnover_range: "10_50",
      gst_registered: false,
    },
    parties: [
      {
        party_id: "30000000-0000-4000-8000-000000000001",
        role: "applicant",
        is_primary: true,
        ownership_pct: null,
        full_name: "Anita Rao",
        mobile_masked: "98XXXX3210",
        email_masked: "a****@example.com",
        type_of_residence: "owned",
        employment_status_code: "self_employed",
        identifiers: { pan_masked: "ABCDE***4F", aadhaar_masked: "XXXX XXXX 1234" },
      },
    ],
    registrations: { entity_pan_masked: null, gstin_masked: null, gst_state_code: null },
  };
}

function requirementsResponse(): RequirementsResponse {
  return {
    application_id: "10000000-0000-4000-8000-000000000001",
    lock_version: 6,
    credit_declaration: { has_active_credit_facilities: null, declared_cibil_score: null },
    facilities: [],
    requirements: [
      {
        application_requirement_id: "req-1",
        document_type_code: "pan_card",
        display_name: "PAN Card",
        category: "kyc",
        attaches_to: "person",
        application_party_id: "30000000-0000-4000-8000-000000000001",
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
    ],
  };
}

describe("WizardShell Phase 4 requirements loading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    api.fetchCurrentApplication.mockResolvedValue(completeSnapshot());
  });

  afterEach(() => cleanup());

  it("shows a loading message while requirements are still loading", async () => {
    api.fetchRequirements.mockImplementation(() => new Promise(() => {})); // never resolves

    render(<WizardShell locale="en" steps={steps} />);

    expect(await screen.findByRole("heading", { name: "Documents" })).toBeVisible();
    expect(screen.getByText("Loading your document checklist…")).toBeVisible();
  });

  it("shows a retryable error, not an indefinite loading message, when the fetch fails", async () => {
    api.fetchRequirements.mockRejectedValue(new Error("network down"));

    render(<WizardShell locale="en" steps={steps} />);

    await screen.findByRole("heading", { name: "Documents" });
    expect(await screen.findByRole("button", { name: "Retry" })).toBeVisible();
    expect(screen.queryByText("Loading your document checklist…")).toBeNull();
  });

  it("recovers via retry and renders the checklist after a successful reload", async () => {
    api.fetchRequirements
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(requirementsResponse());

    render(<WizardShell locale="en" steps={steps} />);

    await screen.findByRole("heading", { name: "Documents" });
    const retryButton = await screen.findByRole("button", { name: "Retry" });
    fireEvent.click(retryButton);

    expect(await screen.findByText("PAN Card")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });
});
