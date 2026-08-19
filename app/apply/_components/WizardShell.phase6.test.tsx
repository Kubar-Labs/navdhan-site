/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  fetchConsentStatus: vi.fn(),
  saveConsentGrants: vi.fn(),
  submitCollectionApplication: vi.fn(),
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
  { id: "aadhaar_verification" as const, title: "Aadhaar Details" },
  { id: "pan_verification" as const, title: "PAN Details" },
  { id: "gst_verification" as const, title: "GST Details" },
  { id: "itr_upload" as const, title: "Documents" },
  { id: "bank_statements" as const, title: "Existing loans" },
  { id: "review_submit" as const, title: "Review & submit" },
  { id: "submission_result" as const, title: "Submission result" },
];

function completeSnapshot(overrides: Partial<CollectionWriteResponse> = {}): CollectionWriteResponse {
  return {
    application_id: "10000000-0000-4000-8000-000000000001",
    application_no: "ND-2026-0001",
    status: "in_progress",
    current_step: "business_profile",
    checklist_version_id: "20000000-0000-4000-8000-000000000001",
    requirements_count: 0,
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
    ...overrides,
  };
}

function requirementsResponse(
  overrides: Partial<RequirementsResponse> = {},
): RequirementsResponse {
  return {
    application_id: "10000000-0000-4000-8000-000000000001",
    lock_version: 6,
    credit_declaration: { has_active_credit_facilities: null, declared_cibil_score: null },
    facilities: [],
    requirements: [],
    ...overrides,
  };
}

async function navigateToReviewSubmit(): Promise<void> {
  await screen.findByRole("heading", { name: "Documents" });
  fireEvent.click(screen.getByRole("button", { name: /continue/i }));
  await screen.findByRole("heading", { name: "Existing loans" });
  fireEvent.click(screen.getByRole("button", { name: /continue/i }));
  await screen.findByRole("heading", { name: "Review & submit" });
}

describe("WizardShell Phase 6 backend-authoritative restore and review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    api.fetchRequirements.mockResolvedValue(requirementsResponse());
    api.fetchConsentStatus.mockResolvedValue({
      application_id: "10000000-0000-4000-8000-000000000001",
      lock_version: 6,
      purposes: [],
    });
  });

  afterEach(() => cleanup());

  it("resumes a submitted application straight to submission_result, not an editable step", async () => {
    api.fetchCurrentApplication.mockResolvedValue(
      completeSnapshot({ status: "submitted", lock_version: 9 }),
    );

    render(<WizardShell locale="en" steps={steps} />);

    await screen.findByRole("heading", { name: "Submission result" });
    expect(await screen.findByTestId("reference-number")).toHaveTextContent("ND-2026-0001");

    // No editable step content and no Continue/Submit footer button should
    // ever have been rendered for a submitted application on resume.
    expect(screen.queryByLabelText("Registered business name")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /continue/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
  });

  it("renders Review entirely from the fetched application snapshot", async () => {
    // Regression for Review preferring stale client-side `values` state
    // over the persisted backend snapshot. `initialValues` seeds `values`
    // with numbers that disagree with what the backend GET resolves to on
    // mount — Review must show the backend's numbers, never these.
    api.fetchCurrentApplication.mockResolvedValue(completeSnapshot());

    render(
      <WizardShell
        locale="en"
        steps={steps}
        initialValues={{ loan_amount: 999, full_name: "Stale Client Name" }}
      />,
    );

    await navigateToReviewSubmit();

    expect(await screen.findByText("₹5,00,000")).toBeVisible();
    expect(screen.getByText("Anita Rao")).toBeVisible();
    expect(screen.getByText("98XXXX3210")).toBeVisible();
    expect(screen.getByText("a****@example.com")).toBeVisible();
    expect(screen.getByText("XXXX XXXX 1234")).toBeVisible();
    expect(screen.getByText("ABCDE***4F")).toBeVisible();
    expect(screen.queryByText("₹999")).not.toBeInTheDocument();
    expect(screen.queryByText("Stale Client Name")).not.toBeInTheDocument();
  });

  it("adds the second director for private_limited instead of overwriting the primary applicant", async () => {
    // Regression: for private_limited, collection_application.py stores the
    // PRIMARY applicant's own party role as "director" too (not
    // "applicant") — the same role string as the second, additional
    // director. Matching by role alone without excluding is_primary finds
    // the primary party and PUTs over it, which the backend rejects
    // (InvalidApplicationOperationError → 422, "Use the primary-person
    // endpoint"). This only reproduces for private_limited: partnership's
    // primary role is "applicant", distinct from "co_applicant".
    const incompleteSnapshot: CollectionWriteResponse = {
      application_id: "40000000-0000-4000-8000-000000000001",
      application_no: "ND-2026-0099",
      status: "in_progress",
      current_step: "business_profile",
      checklist_version_id: "20000000-0000-4000-8000-000000000001",
      requirements_count: 0,
      lock_version: 3,
      values: {
        constitution: "private_limited",
        requested_amount: 900_000,
        requested_tenure_months: 12,
        purpose: "machinery",
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
      parties: [
        {
          party_id: "50000000-0000-4000-8000-000000000001",
          role: "director",
          is_primary: true,
          ownership_pct: null,
          full_name: null,
          mobile_masked: null,
          email_masked: null,
          type_of_residence: null,
          employment_status_code: null,
          identifiers: { pan_masked: null, aadhaar_masked: null },
        },
      ],
      registrations: { entity_pan_masked: null, gstin_masked: null, gst_state_code: null },
    };

    api.fetchCurrentApplication.mockResolvedValue(incompleteSnapshot);
    api.saveBusinessProfile.mockResolvedValue({ ...incompleteSnapshot, lock_version: 4 });
    api.savePrimaryPerson.mockResolvedValue({
      ...incompleteSnapshot,
      lock_version: 5,
      parties: [{ ...incompleteSnapshot.parties[0], full_name: "Anita Rao" }],
    });
    api.addApplicationParty.mockResolvedValue({
      ...incompleteSnapshot,
      lock_version: 6,
      parties: [
        { ...incompleteSnapshot.parties[0], full_name: "Anita Rao" },
        {
          party_id: "50000000-0000-4000-8000-000000000002",
          role: "director",
          is_primary: false,
          ownership_pct: null,
          full_name: "Vikram Shah",
          mobile_masked: null,
          email_masked: null,
          type_of_residence: null,
          employment_status_code: null,
          identifiers: { pan_masked: null, aadhaar_masked: null },
        },
      ],
    });

    const { container } = render(<WizardShell locale="en" steps={steps} />);
    const byId = (id: string): HTMLElement => {
      const el = container.querySelector<HTMLElement>(`#${id}`);
      if (!el) throw new Error(`No element with id ${id}`);
      return el;
    };

    await screen.findByRole("heading", { name: "Personal contact" });
    // "Full name"/"Mobile number"/"Email"/"Residence type"/"Employment
    // status" each render twice (primary applicant + director) with
    // identical label text but distinct ids — query by id to disambiguate.
    fireEvent.change(byId("business_legal_name"), {
      target: { value: "Kubar Traders Pvt Ltd" },
    });
    fireEvent.change(byId("business_type_code"), { target: { value: "manufacturing" } });
    fireEvent.change(byId("income_type_code"), { target: { value: "business_income" } });
    fireEvent.change(byId("type_of_office"), { target: { value: "owned_office" } });
    fireEvent.change(byId("location_tier"), { target: { value: "tier1" } });
    fireEvent.change(byId("full_name"), { target: { value: "Anita Rao" } });
    fireEvent.change(byId("mobile_number"), { target: { value: "9876501234" } });
    fireEvent.change(byId("email"), { target: { value: "anita@example.com" } });
    fireEvent.change(byId("business_pin_code"), { target: { value: "560001" } });
    fireEvent.change(byId("annual_turnover"), { target: { value: "10_50" } });
    fireEvent.change(byId("type_of_residence"), { target: { value: "owned" } });
    fireEvent.change(byId("employment_status_code"), { target: { value: "self_employed" } });
    fireEvent.click(screen.getByRole("radio", { name: "Not registered" }));

    fireEvent.change(byId("additional_party_full_name"), {
      target: { value: "Vikram Shah" },
    });
    fireEvent.change(byId("additional_party_mobile_number"), {
      target: { value: "9876512345" },
    });
    fireEvent.change(byId("additional_party_email"), {
      target: { value: "vikram@example.com" },
    });
    fireEvent.change(byId("additional_party_type_of_residence"), {
      target: { value: "rented" },
    });
    fireEvent.change(byId("additional_party_employment_status_code"), {
      target: { value: "self_employed" },
    });

    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => expect(api.addApplicationParty).toHaveBeenCalled());
    expect(api.addApplicationParty).toHaveBeenCalledWith(
      expect.objectContaining({ role: "director", full_name: "Vikram Shah" }),
    );
    expect(api.updateApplicationParty).not.toHaveBeenCalled();
  });
});
