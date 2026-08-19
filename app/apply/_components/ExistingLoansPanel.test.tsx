/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  addCreditFacility: vi.fn(),
  saveCreditDeclaration: vi.fn(),
  uploadRequirementDocument: vi.fn(),
  deleteRequirementDocument: vi.fn(),
  fetchRequirements: vi.fn(),
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

import { ExistingLoansPanel } from "./ExistingLoansPanel";
import type { RequirementsResponse } from "@/app/apply/lib/types";

function response(overrides: Partial<RequirementsResponse> = {}): RequirementsResponse {
  return {
    application_id: "app-1",
    lock_version: 5,
    credit_declaration: { has_active_credit_facilities: true, declared_cibil_score: 750 },
    facilities: [],
    requirements: [],
    ...overrides,
  };
}

describe("ExistingLoansPanel", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("labels the generic credit option 'Credit', not 'Credit card'", () => {
    render(<ExistingLoansPanel requirements={response()} onChange={vi.fn()} />);

    expect(screen.getByRole("option", { name: "Credit" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Credit card" })).toBeNull();
  });

  it("submits the complete approved existing-loan field set", async () => {
    const data = response();
    api.addCreditFacility.mockResolvedValue(response());

    render(<ExistingLoansPanel requirements={data} onChange={vi.fn()} />);

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

    await waitFor(() =>
      expect(api.addCreditFacility).toHaveBeenCalledWith({
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
        expected_lock_version: 5,
      }),
    );
  });

  it("rejects an end date before the start date before submitting", async () => {
    render(<ExistingLoansPanel requirements={response()} onChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Lender name"), { target: { value: "Test Bank" } });
    fireEvent.change(screen.getByLabelText("Loan amount"), { target: { value: "200000" } });
    fireEvent.change(screen.getByLabelText("Outstanding amount"), { target: { value: "100000" } });
    fireEvent.change(screen.getByLabelText("EMI amount"), { target: { value: "5000" } });
    fireEvent.change(screen.getByLabelText("ROI (%)"), { target: { value: "11.5" } });
    fireEvent.change(screen.getByLabelText("Tenure (months)"), { target: { value: "36" } });
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2027-01-01" } });
    fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2024-01-01" } });
    fireEvent.change(screen.getByLabelText("Paid EMI count"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Add loan" }));

    expect(await screen.findByText("End date cannot be before the start date")).toBeVisible();
    expect(api.addCreditFacility).not.toHaveBeenCalled();
  });

  it("renders facility-scoped sanction-letter and loan-track rows under each declared facility", () => {
    const data = response({
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
      requirements: [
        {
          application_requirement_id: "req-sanction",
          document_type_code: "sanction_letter",
          display_name: "Sanction Letter",
          category: "obligation",
          attaches_to: "facility",
          application_party_id: null,
          facility_id: "facility-1",
          obligation: "conditional",
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
          application_requirement_id: "req-track",
          document_type_code: "existing_loan_track",
          display_name: "Existing Loan Track",
          category: "obligation",
          attaches_to: "facility",
          application_party_id: null,
          facility_id: "facility-1",
          obligation: "conditional",
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
    });

    render(<ExistingLoansPanel requirements={data} onChange={vi.fn()} />);

    expect(screen.getByText("Sanction Letter")).toBeVisible();
    expect(screen.getByText("Existing Loan Track")).toBeVisible();
  });

  it("does not show the facility form when no active facilities are declared", () => {
    render(
      <ExistingLoansPanel
        requirements={response({
          credit_declaration: { has_active_credit_facilities: false, declared_cibil_score: 750 },
        })}
        onChange={vi.fn()}
      />,
    );

    expect(screen.queryByText("Add an existing loan")).toBeNull();
  });
});
