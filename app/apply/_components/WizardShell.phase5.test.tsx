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
import type {
  CollectionWriteResponse,
  ConsentStatusResponse,
  RequirementsResponse,
  SubmitApplicationResponse,
} from "@/app/apply/lib/types";

const steps = [
  { id: "loan_intent" as const, title: "Loan intent" },
  { id: "personal_contact" as const, title: "Personal contact" },
  { id: "aadhaar_verification" as const, title: "Aadhaar verification" },
  { id: "pan_verification" as const, title: "PAN verification" },
  { id: "gst_verification" as const, title: "GST verification" },
  { id: "itr_upload" as const, title: "Documents" },
  { id: "bank_statements" as const, title: "Existing loans" },
  { id: "review_submit" as const, title: "Review & submit" },
  { id: "submission_result" as const, title: "Submission result" },
];

// Resumes straight to the itr_upload step, same shape as the Phase 4 tests.
function completeSnapshot(): CollectionWriteResponse {
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
  };
}

function requirementsResponse(
  overrides: Partial<RequirementsResponse> = {},
): RequirementsResponse {
  return {
    application_id: "10000000-0000-4000-8000-000000000001",
    lock_version: 6,
    credit_declaration: { has_active_credit_facilities: false, declared_cibil_score: 750 },
    facilities: [],
    requirements: [],
    ...overrides,
  };
}

function consentStatusResponse(
  overrides: Partial<ConsentStatusResponse> = {},
): ConsentStatusResponse {
  return {
    application_id: "10000000-0000-4000-8000-000000000001",
    lock_version: 6,
    purposes: [
      {
        purpose_code: "privacy_policy",
        display_name: "I agree to the Privacy Policy",
        notice_text: "I agree to the Privacy Policy",
        notice_version: 1,
        is_mandatory: true,
        granted: false,
      },
      {
        purpose_code: "terms_of_use",
        display_name: "I agree to the Terms of Use",
        notice_text: "I agree to the Terms of Use",
        notice_version: 1,
        is_mandatory: true,
        granted: false,
      },
      {
        purpose_code: "credit_bureau_check",
        display_name: "I consent to a credit bureau check",
        notice_text: "I consent to a credit bureau check",
        notice_version: 1,
        is_mandatory: true,
        granted: false,
      },
      {
        purpose_code: "communications",
        display_name: "I consent to receive communication from NavDhan",
        notice_text: "I consent to receive communication from NavDhan",
        notice_version: 1,
        is_mandatory: false,
        granted: false,
      },
    ],
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

describe("WizardShell Phase 5 consent and submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    api.fetchCurrentApplication.mockResolvedValue(completeSnapshot());
    api.fetchRequirements.mockResolvedValue(requirementsResponse());
    api.fetchConsentStatus.mockResolvedValue(consentStatusResponse());
  });

  afterEach(() => cleanup());

  it("renders every consent purpose and disables submit until mandatory ones are checked", async () => {
    render(<WizardShell locale="en" steps={steps} />);

    await navigateToReviewSubmit();

    expect(screen.getByText("I agree to the Privacy Policy")).toBeVisible();
    expect(
      screen.getByText("I consent to receive communication from NavDhan"),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });

  it("enables submit once every mandatory purpose is checked", async () => {
    render(<WizardShell locale="en" steps={steps} />);

    await navigateToReviewSubmit();

    fireEvent.click(screen.getByRole("checkbox", { name: /Privacy Policy/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Terms of Use/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /credit bureau check/i }));

    expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
  });

  it("keeps submit disabled and lists outstanding requirements when a blocking document is still pending", async () => {
    api.fetchCurrentApplication.mockResolvedValue({
      ...completeSnapshot(),
      current_step: "review_submit",
    });
    api.fetchRequirements.mockResolvedValue(
      requirementsResponse({
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
      }),
    );

    render(<WizardShell locale="en" steps={steps} initialStepId="review_submit" />);

    const checkboxes = await screen.findAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[2]);

    expect(await screen.findByText("Complete these before submitting:")).toBeVisible();
    expect(screen.getByText("PAN Card")).toBeVisible();
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });

  it("submits successfully and shows the real application number", async () => {
    api.saveConsentGrants.mockResolvedValue(
      consentStatusResponse({
        lock_version: 7,
        purposes: consentStatusResponse().purposes.map((purpose) => ({
          ...purpose,
          granted: true,
        })),
      }),
    );
    const submitResponse: SubmitApplicationResponse = {
      application_id: "10000000-0000-4000-8000-000000000001",
      application_no: "ND-2026-0001",
      status: "submitted",
      submitted_at: "2026-08-14T00:00:00+00:00",
      lock_version: 8,
    };
    api.submitCollectionApplication.mockResolvedValue(submitResponse);

    render(<WizardShell locale="en" steps={steps} />);

    await navigateToReviewSubmit();
    fireEvent.click(screen.getByRole("checkbox", { name: /Privacy Policy/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Terms of Use/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /credit bureau check/i }));

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await screen.findByRole("heading", { name: "Submission result" });
    expect(await screen.findByTestId("reference-number")).toHaveTextContent("ND-2026-0001");
    expect(api.submitCollectionApplication).toHaveBeenCalledWith({ expected_lock_version: 7 });
  });

  it("uses the lock version returned by a requirements-track write, not the stale application-track version, on the very next mutation", async () => {
    // Regression for: a single-tab false-positive 409 ("changed in another
    // tab") caused by `application`, `requirements`, and `consentStatus`
    // independently tracking the same backend lock_version without
    // reconciling. Declaring a facility on the Existing Loans step advances
    // the real version to 9 while `application` state (last touched by
    // business-profile/etc. earlier in the wizard) still holds 6 — the next
    // write from this same tab must use 9, not the stale 6.
    api.fetchRequirements.mockResolvedValue(
      requirementsResponse({
        credit_declaration: { has_active_credit_facilities: true, declared_cibil_score: 750 },
      }),
    );
    api.addCreditFacility.mockResolvedValue(
      requirementsResponse({
        lock_version: 9,
        credit_declaration: { has_active_credit_facilities: true, declared_cibil_score: 750 },
        facilities: [
          {
            facility_id: "facility-1",
            facility_type: "business",
            lender_name: "Test Bank",
            original_loan_amount: 200000,
            outstanding_amount: 100000,
            emi_amount: 5000,
            interest_rate_percent: 11.5,
            tenure_months: 36,
            start_date: "2024-01-01",
            end_date: "2027-01-01",
            emis_paid_count: 12,
            is_closed: false,
          },
        ],
      }),
    );
    api.saveConsentGrants.mockResolvedValue(
      consentStatusResponse({
        purposes: consentStatusResponse().purposes.map((purpose) => ({
          ...purpose,
          granted: true,
        })),
      }),
    );
    api.submitCollectionApplication.mockResolvedValue({
      application_id: "10000000-0000-4000-8000-000000000001",
      application_no: "ND-2026-0001",
      status: "submitted",
      submitted_at: "2026-08-14T00:00:00+00:00",
      lock_version: 10,
    });

    render(<WizardShell locale="en" steps={steps} />);

    await screen.findByRole("heading", { name: "Documents" });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await screen.findByRole("heading", { name: "Existing loans" });

    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "business" } });
    fireEvent.change(screen.getByLabelText("Lender name"), { target: { value: "Test Bank" } });
    fireEvent.change(screen.getByLabelText("Loan amount"), { target: { value: "200000" } });
    fireEvent.change(screen.getByLabelText("Outstanding amount"), { target: { value: "100000" } });
    fireEvent.change(screen.getByLabelText("EMI amount"), { target: { value: "5000" } });
    fireEvent.change(screen.getByLabelText("ROI (%)"), { target: { value: "11.5" } });
    fireEvent.change(screen.getByLabelText("Tenure (months)"), { target: { value: "36" } });
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2024-01-01" } });
    fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2027-01-01" } });
    fireEvent.change(screen.getByLabelText("Paid EMI count"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Add loan" }));
    await waitFor(() => expect(api.addCreditFacility).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await screen.findByRole("heading", { name: "Review & submit" });
    fireEvent.click(screen.getByRole("checkbox", { name: /Privacy Policy/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Terms of Use/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /credit bureau check/i }));

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(api.saveConsentGrants).toHaveBeenCalled());
    expect(api.saveConsentGrants).toHaveBeenCalledWith(
      expect.objectContaining({ expected_lock_version: 9 }),
    );
    await screen.findByRole("heading", { name: "Submission result" });
  });

  it("shows a completeness error and stays on the review step when the backend rejects an incomplete submission", async () => {
    api.saveConsentGrants.mockResolvedValue(
      consentStatusResponse({
        purposes: consentStatusResponse().purposes.map((purpose) => ({
          ...purpose,
          granted: true,
        })),
      }),
    );
    api.submitCollectionApplication.mockRejectedValue({ status: 422 });

    render(<WizardShell locale="en" steps={steps} />);

    await navigateToReviewSubmit();
    fireEvent.click(screen.getByRole("checkbox", { name: /Privacy Policy/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Terms of Use/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /credit bureau check/i }));

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(
      await screen.findByText("Your application is not complete yet. Please review the checklist above."),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Review & submit" })).toBeVisible();
  });
});
