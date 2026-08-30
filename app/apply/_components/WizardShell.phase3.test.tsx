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
import type { CollectionWriteResponse } from "@/app/apply/lib/types";
import { STORAGE_KEY } from "@/app/apply/lib/constants";

const steps = [
  { id: "loan_intent" as const, title: "Loan intent" },
  { id: "personal_contact" as const, title: "Personal contact" },
  { id: "aadhaar_verification" as const, title: "Aadhaar verification" },
  { id: "pan_verification" as const, title: "PAN verification" },
  { id: "gst_verification" as const, title: "GST verification" },
];

function snapshot(overrides: Partial<CollectionWriteResponse> = {}): CollectionWriteResponse {
  return {
    application_id: "10000000-0000-4000-8000-000000000001",
    application_no: "ND-2026-0001",
    status: "DRAFT",
    current_step: "business_profile",
    checklist_version_id: "20000000-0000-4000-8000-000000000001",
    requirements_count: 4,
    lock_version: 1,
    values: {
      constitution: "proprietorship",
      requested_amount: 500_000,
      requested_tenure_months: 6,
      purpose: "working_capital",
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
        party_id: "30000000-0000-4000-8000-000000000001",
        role: "primary_borrower",
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
    registrations: {
      entity_pan_masked: null,
      gstin_masked: null,
      gst_state_code: null,
    },
    ...overrides,
  };
}

function fillLoanIntent(constitution = "proprietorship") {
  fireEvent.change(screen.getByLabelText("Business constitution"), {
    target: { value: constitution },
  });
  fireEvent.change(screen.getByLabelText("Loan amount"), { target: { value: "500000" } });
  fireEvent.change(screen.getByLabelText("Tenure (months)"), { target: { value: "6" } });
  fireEvent.change(screen.getByLabelText("Purpose"), { target: { value: "working_capital" } });
}

function changeField(id: string, value: string) {
  const field = document.getElementById(id);
  if (!field) throw new Error(`Missing field ${id}`);
  fireEvent.change(field, { target: { value } });
}

const completeProfile: CollectionWriteResponse["business_profile"] = {
  business_legal_name: "NavDhan Traders",
  trade_name: null,
  business_type_code: "trading",
  income_type_code: "business_income",
  type_of_office: "owned_office",
  location_tier: "tier1",
  business_pincode: "560001",
  annual_turnover_range: "10_50",
  gst_registered: false,
};

describe("WizardShell Phase 3 browser integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    api.fetchCurrentApplication.mockRejectedValue({ status: 401 });
    api.createApplySession.mockResolvedValue({ created: true });
  });

  afterEach(() => cleanup());

  it("creates a same-browser session only when the current-session lookup is unauthorized", async () => {
    render(<WizardShell locale="en" steps={steps} />);

    await waitFor(() => expect(api.fetchCurrentApplication).toHaveBeenCalledOnce());
    expect(api.createApplySession).toHaveBeenCalledOnce();
  });

  it("removes legacy browser drafts that may contain plaintext PII", async () => {
    window.localStorage.setItem(
      `${STORAGE_KEY}-en`,
      JSON.stringify({ mobile_number: "9876543210", pan_number: "ABCDE1234F" }),
    );

    render(<WizardShell locale="en" steps={steps} />);

    await waitFor(() => expect(api.createApplySession).toHaveBeenCalledOnce());
    expect(window.localStorage.getItem(`${STORAGE_KEY}-en`)).toBeNull();
  });

  it("creates the current application from loan intent before advancing", async () => {
    api.saveLoanIntent.mockResolvedValue(snapshot());
    render(<WizardShell locale="en" steps={steps} />);

    await waitFor(() => expect(api.createApplySession).toHaveBeenCalledOnce());
    fillLoanIntent();
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() =>
      expect(api.saveLoanIntent).toHaveBeenCalledWith({
        constitution: "proprietorship",
        requested_amount: 500_000,
        requested_tenure_months: 6,
        purpose: "working_capital",
        expected_lock_version: 0,
      }),
    );
    expect(await screen.findByRole("heading", { name: "Personal contact" })).toBeVisible();
  });

  it("resumes from a masked backend snapshot without putting sensitive values in inputs", async () => {
    api.fetchCurrentApplication.mockResolvedValue(
      snapshot({
        lock_version: 8,
        business_profile: {
          business_legal_name: "NavDhan Traders",
          trade_name: null,
          business_type_code: "trading",
          income_type_code: "business_income",
          type_of_office: "owned_office",
          location_tier: null,
          business_pincode: "560001",
          annual_turnover_range: "10_50",
          gst_registered: true,
        },
        parties: [
          {
            party_id: "30000000-0000-4000-8000-000000000001",
            role: "primary_borrower",
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
        registrations: {
          entity_pan_masked: null,
          gstin_masked: "27**********1Z5",
          gst_state_code: "27",
        },
      }),
    );

    render(<WizardShell locale="en" steps={steps} />);

    expect(await screen.findByText("Saved: 98XXXX3210")).toBeVisible();
    expect(screen.getByLabelText("Mobile number")).toHaveValue("");
    expect(screen.getByText("Saved: a****@example.com")).toBeVisible();
    expect(api.createApplySession).not.toHaveBeenCalled();
  });

  it("saves business, primary person, then the constitution-specific party with chained locks", async () => {
    const partnership = snapshot({
      values: {
        constitution: "partnership",
        requested_amount: 500_000,
        requested_tenure_months: 6,
        purpose: "working_capital",
        referral_code: null,
      },
    });
    api.saveLoanIntent.mockResolvedValue(partnership);
    api.saveBusinessProfile.mockResolvedValue(snapshot({ lock_version: 2 }));
    api.savePrimaryPerson.mockResolvedValue(snapshot({ lock_version: 3 }));
    api.addApplicationParty.mockResolvedValue(snapshot({ lock_version: 4 }));
    render(<WizardShell locale="en" steps={steps} />);
    await waitFor(() => expect(api.createApplySession).toHaveBeenCalledOnce());

    fillLoanIntent("partnership");
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await screen.findByRole("heading", { name: "Personal contact" });

    changeField("business_legal_name", "NavDhan Traders");
    changeField("business_type_code", "trading");
    changeField("income_type_code", "business_income");
    changeField("type_of_office", "owned_office");
    changeField("location_tier", "tier1");
    changeField("full_name", "Anita Rao");
    changeField("mobile_number", "9876543210");
    changeField("email", "anita@example.com");
    changeField("business_pin_code", "560001");
    changeField("annual_turnover", "10_50");
    changeField("type_of_residence", "owned");
    changeField("employment_status_code", "self_employed");
    fireEvent.click(screen.getByLabelText("Not registered"));
    changeField("additional_party_full_name", "Ravi Shah");
    changeField("additional_party_mobile_number", "9876543211");
    changeField("additional_party_email", "ravi@example.com");
    changeField("additional_party_type_of_residence", "rented");
    changeField("additional_party_employment_status_code", "self_employed");
    changeField("additional_party_ownership_pct", "40");
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => expect(api.addApplicationParty).toHaveBeenCalledOnce());
    expect(api.saveBusinessProfile).toHaveBeenCalledWith({
      business_legal_name: "NavDhan Traders",
      business_type_code: "trading",
      income_type_code: "business_income",
      type_of_office: "owned_office",
      location_tier: "tier1",
      business_pincode: "560001",
      annual_turnover_range: "10_50",
      gst_registered: false,
      expected_lock_version: 1,
    });
    expect(api.savePrimaryPerson).toHaveBeenCalledWith(
      expect.objectContaining({ expected_lock_version: 2, mobile_number: "9876543210" }),
    );
    expect(api.addApplicationParty).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "co_applicant",
        ownership_pct: 40,
        expected_lock_version: 3,
      }),
    );
    expect(await screen.findByRole("heading", { name: "Aadhaar verification" })).toBeVisible();
  });

  it("saves personal Aadhaar, personal PAN, and entity PAN through the primary party", async () => {
    const primaryParty = snapshot().parties[0];
    const resumed = snapshot({
      lock_version: 8,
      values: {
        constitution: "partnership",
        requested_amount: 500_000,
        requested_tenure_months: 6,
        purpose: "working_capital",
        referral_code: null,
      },
      business_profile: completeProfile,
      parties: [
        {
          ...primaryParty,
          full_name: "Anita Rao",
          mobile_masked: "98XXXX3210",
          email_masked: "a****@example.com",
          type_of_residence: "owned",
          employment_status_code: "self_employed",
        },
        {
          ...primaryParty,
          party_id: "30000000-0000-4000-8000-000000000002",
          role: "co_applicant",
          is_primary: false,
          full_name: "Ravi Shah",
          type_of_residence: "rented",
          employment_status_code: "self_employed",
        },
      ],
    });
    api.fetchCurrentApplication.mockResolvedValue(resumed);
    api.saveAadhaarIdentity
      .mockResolvedValueOnce(snapshot({ ...resumed, lock_version: 9 }))
      .mockResolvedValueOnce(snapshot({ ...resumed, lock_version: 10 }));
    api.savePanIdentity
      .mockResolvedValueOnce(snapshot({ ...resumed, lock_version: 11 }))
      .mockResolvedValueOnce(snapshot({ ...resumed, lock_version: 12 }));
    api.saveEntityPan.mockResolvedValue(snapshot({ ...resumed, lock_version: 13 }));
    render(<WizardShell locale="en" steps={steps} />);

    await screen.findByRole("heading", { name: "Aadhaar verification" });
    changeField(`aadhaar_number_${resumed.parties[0].party_id}`, "123412341234");
    changeField(`confirm_aadhaar_number_${resumed.parties[0].party_id}`, "123412341234");
    changeField(`aadhaar_number_${resumed.parties[1].party_id}`, "567856785678");
    changeField(`confirm_aadhaar_number_${resumed.parties[1].party_id}`, "567856785678");
    fireEvent.click(screen.getByRole("checkbox", { name: "Aadhaar consent" }));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await waitFor(() => expect(api.saveAadhaarIdentity).toHaveBeenCalledTimes(2));
    await screen.findByRole("heading", { name: "PAN verification" });

    changeField(`pan_number_${resumed.parties[0].party_id}`, "ABCDE1234F");
    changeField(`confirm_pan_number_${resumed.parties[0].party_id}`, "ABCDE1234F");
    changeField(`pan_number_${resumed.parties[1].party_id}`, "FGHIJ5678K");
    changeField(`confirm_pan_number_${resumed.parties[1].party_id}`, "FGHIJ5678K");
    changeField("entity_pan", "LMNOP9012Q");
    changeField("confirm_entity_pan", "LMNOP9012Q");
    fireEvent.click(screen.getByRole("checkbox", { name: "PAN consent" }));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => expect(api.saveEntityPan).toHaveBeenCalledOnce());
    expect(api.saveAadhaarIdentity).toHaveBeenCalledWith(resumed.parties[0].party_id, {
      aadhaar_number: "123412341234",
      expected_lock_version: 8,
    });
    expect(api.saveAadhaarIdentity).toHaveBeenCalledWith(resumed.parties[1].party_id, {
      aadhaar_number: "567856785678",
      expected_lock_version: 9,
    });
    expect(api.savePanIdentity).toHaveBeenCalledWith(resumed.parties[0].party_id, {
      pan_number: "ABCDE1234F",
      expected_lock_version: 10,
    });
    expect(api.savePanIdentity).toHaveBeenCalledWith(resumed.parties[1].party_id, {
      pan_number: "FGHIJ5678K",
      expected_lock_version: 11,
    });
    expect(api.saveEntityPan).toHaveBeenCalledWith({
      entity_pan: "LMNOP9012Q",
      expected_lock_version: 12,
    });
  });

  it("derives the GST state code and persists the registration with the next lock", async () => {
    const primaryParty = snapshot().parties[0];
    const resumed = snapshot({
      lock_version: 9,
      business_profile: { ...completeProfile, gst_registered: true },
      parties: [
        {
          ...primaryParty,
          full_name: "Anita Rao",
          type_of_residence: "owned",
          employment_status_code: "self_employed",
          identifiers: { pan_masked: "ABCDE***4F", aadhaar_masked: "XXXX XXXX 1234" },
        },
      ],
    });
    api.fetchCurrentApplication.mockResolvedValue(resumed);
    api.saveBusinessProfile.mockResolvedValue(snapshot({ ...resumed, lock_version: 10 }));
    api.saveGstRegistration.mockResolvedValue(snapshot({ ...resumed, lock_version: 11 }));
    render(<WizardShell locale="en" steps={steps} />);

    await screen.findByRole("heading", { name: "GST verification" });
    changeField("gstin", "27ABCDE1234F1Z5");
    changeField("confirm_gstin", "27ABCDE1234F1Z5");
    fireEvent.click(screen.getByRole("checkbox", { name: "GST consent" }));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => expect(api.saveGstRegistration).toHaveBeenCalledOnce());
    expect(api.saveBusinessProfile).toHaveBeenCalledWith(
      expect.objectContaining({ expected_lock_version: 9, gst_registered: true }),
    );
    expect(api.saveGstRegistration).toHaveBeenCalledWith({
      gst_registered: true,
      gst_consent: true,
      gstin: "27ABCDE1234F1Z5",
      state_code: "27",
      expected_lock_version: 10,
    });
  });

  it("does not resume past Aadhaar when a partnership co-applicant is still missing KYC", async () => {
    const primary = snapshot().parties[0];
    const coApplicant = {
      ...primary,
      party_id: "30000000-0000-4000-8000-000000000002",
      role: "co_applicant",
      is_primary: false,
      full_name: "Ravi Shah",
      type_of_residence: "rented" as const,
      employment_status_code: "self_employed" as const,
      identifiers: { pan_masked: "FGHIJ***8K", aadhaar_masked: null },
    };
    api.fetchCurrentApplication.mockResolvedValue(
      snapshot({
        lock_version: 12,
        values: {
          constitution: "partnership",
          requested_amount: 500_000,
          requested_tenure_months: 6,
          purpose: "working_capital",
          referral_code: null,
        },
        business_profile: completeProfile,
        parties: [
          {
            ...primary,
            full_name: "Anita Rao",
            type_of_residence: "owned",
            employment_status_code: "self_employed",
            identifiers: { pan_masked: "ABCDE***4F", aadhaar_masked: "XXXX XXXX 1234" },
          },
          coApplicant,
        ],
        registrations: {
          entity_pan_masked: "LMNOP***2Q",
          gstin_masked: null,
          gst_state_code: null,
        },
      }),
    );

    render(<WizardShell locale="en" steps={steps} />);

    expect(await screen.findByRole("heading", { name: "Aadhaar verification" })).toBeVisible();
    expect(screen.getByLabelText("Aadhaar number for Anita Rao")).toHaveValue("");
    expect(screen.getByText("Saved: XXXX XXXX 1234")).toBeVisible();
    expect(screen.getByLabelText("Aadhaar number for Ravi Shah")).toHaveValue("");
  });

  it("saves co-applicant and director Aadhaar/PAN with chained lock versions", async () => {
    const primary = snapshot().parties[0];
    const director = {
      ...primary,
      party_id: "30000000-0000-4000-8000-000000000003",
      role: "director",
      is_primary: false,
      full_name: "Meera Shah",
      type_of_residence: "owned" as const,
      employment_status_code: "self_employed" as const,
    };
    const resumed = snapshot({
      lock_version: 20,
      values: {
        constitution: "private_limited",
        requested_amount: 500_000,
        requested_tenure_months: 6,
        purpose: "working_capital",
        referral_code: null,
      },
      business_profile: completeProfile,
      parties: [
        {
          ...primary,
          full_name: "Anita Rao",
          type_of_residence: "owned",
          employment_status_code: "self_employed",
        },
        director,
      ],
    });
    api.fetchCurrentApplication.mockResolvedValue(resumed);
    api.saveAadhaarIdentity
      .mockResolvedValueOnce(snapshot({ ...resumed, lock_version: 21 }))
      .mockResolvedValueOnce(
        snapshot({
          ...resumed,
          lock_version: 22,
          parties: resumed.parties.map((party) => ({
            ...party,
            identifiers: { ...party.identifiers, aadhaar_masked: "XXXX XXXX 1234" },
          })),
        }),
      );
    api.savePanIdentity
      .mockResolvedValueOnce(snapshot({ ...resumed, lock_version: 23 }))
      .mockResolvedValueOnce(snapshot({ ...resumed, lock_version: 24 }));
    api.saveEntityPan.mockResolvedValue(snapshot({ ...resumed, lock_version: 25 }));
    render(<WizardShell locale="en" steps={steps} />);

    await screen.findByRole("heading", { name: "Aadhaar verification" });
    changeField(`aadhaar_number_${primary.party_id}`, "123412341234");
    changeField(`confirm_aadhaar_number_${primary.party_id}`, "123412341234");
    changeField(`aadhaar_number_${director.party_id}`, "567856785678");
    changeField(`confirm_aadhaar_number_${director.party_id}`, "567856785678");
    fireEvent.click(screen.getByRole("checkbox", { name: "Aadhaar consent" }));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await waitFor(() => expect(api.saveAadhaarIdentity).toHaveBeenCalledTimes(2));

    expect(api.saveAadhaarIdentity.mock.calls).toEqual([
      [primary.party_id, { aadhaar_number: "123412341234", expected_lock_version: 20 }],
      [director.party_id, { aadhaar_number: "567856785678", expected_lock_version: 21 }],
    ]);
    await screen.findByRole("heading", { name: "PAN verification" });
    changeField(`pan_number_${primary.party_id}`, "ABCDE1234F");
    changeField(`confirm_pan_number_${primary.party_id}`, "ABCDE1234F");
    changeField(`pan_number_${director.party_id}`, "FGHIJ5678K");
    changeField(`confirm_pan_number_${director.party_id}`, "FGHIJ5678K");
    changeField("entity_pan", "LMNOP9012Q");
    changeField("confirm_entity_pan", "LMNOP9012Q");
    fireEvent.click(screen.getByRole("checkbox", { name: "PAN consent" }));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => expect(api.saveEntityPan).toHaveBeenCalledOnce());
    expect(api.savePanIdentity.mock.calls).toEqual([
      [primary.party_id, { pan_number: "ABCDE1234F", expected_lock_version: 22 }],
      [director.party_id, { pan_number: "FGHIJ5678K", expected_lock_version: 23 }],
    ]);
    expect(api.saveEntityPan).toHaveBeenCalledWith({
      entity_pan: "LMNOP9012Q",
      expected_lock_version: 24,
    });
  });

  it("blocks an entity PAN that matches any entered party personal PAN before writing", async () => {
    const primary = snapshot().parties[0];
    const coApplicant = {
      ...primary,
      party_id: "30000000-0000-4000-8000-000000000002",
      role: "co_applicant",
      is_primary: false,
      full_name: "Ravi Shah",
      type_of_residence: "rented" as const,
      employment_status_code: "self_employed" as const,
      identifiers: { pan_masked: null, aadhaar_masked: "XXXX XXXX 5678" },
    };
    api.fetchCurrentApplication.mockResolvedValue(
      snapshot({
        lock_version: 30,
        values: {
          constitution: "partnership",
          requested_amount: 500_000,
          requested_tenure_months: 6,
          purpose: "working_capital",
          referral_code: null,
        },
        business_profile: completeProfile,
        parties: [
          {
            ...primary,
            full_name: "Anita Rao",
            type_of_residence: "owned",
            employment_status_code: "self_employed",
            identifiers: { pan_masked: null, aadhaar_masked: "XXXX XXXX 1234" },
          },
          coApplicant,
        ],
      }),
    );
    render(<WizardShell locale="en" steps={steps} />);

    await screen.findByRole("heading", { name: "PAN verification" });
    changeField(`pan_number_${primary.party_id}`, "ABCDE1234F");
    changeField(`pan_number_${coApplicant.party_id}`, "FGHIJ5678K");
    changeField("entity_pan", "FGHIJ5678K");
    fireEvent.click(screen.getByRole("checkbox", { name: "PAN consent" }));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(
      await screen.findAllByText("Business PAN must be different from every personal PAN"),
    ).toHaveLength(2);
    expect(api.savePanIdentity).not.toHaveBeenCalled();
    expect(api.saveEntityPan).not.toHaveBeenCalled();
  });

  it("requires a nonblank Aadhaar confirmation and rejects a mismatch", async () => {
    const primary = snapshot().parties[0];
    const resumed = snapshot({
      lock_version: 9,
      business_profile: { ...completeProfile, gst_registered: true },
      parties: [
        {
          ...primary,
          full_name: "Anita Rao",
          type_of_residence: "owned",
          employment_status_code: "self_employed",
          identifiers: { pan_masked: null, aadhaar_masked: null },
        },
      ],
    });
    api.fetchCurrentApplication.mockResolvedValue(resumed);
    render(<WizardShell locale="en" steps={steps} />);

    await screen.findByRole("heading", { name: "Aadhaar verification" });
    changeField(`aadhaar_number_${primary.party_id}`, "123412341234");
    fireEvent.click(screen.getByRole("checkbox", { name: "Aadhaar consent" }));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(await screen.findByText("Confirm the Aadhaar number")).toBeVisible();
    changeField(`confirm_aadhaar_number_${primary.party_id}`, "123412341235");
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(await screen.findByText("Aadhaar numbers do not match")).toBeVisible();
    expect(api.saveAadhaarIdentity).not.toHaveBeenCalled();
  });

  it("requires nonblank personal and business PAN confirmations", async () => {
    const primary = snapshot().parties[0];
    const coApplicant = {
      ...primary,
      party_id: "30000000-0000-4000-8000-000000000002",
      role: "co_applicant",
      is_primary: false,
      full_name: "Ravi Shah",
      type_of_residence: "rented" as const,
      employment_status_code: "self_employed" as const,
      identifiers: { pan_masked: "FGHIJ***8K", aadhaar_masked: "XXXX XXXX 5678" },
    };
    api.fetchCurrentApplication.mockResolvedValue(
      snapshot({
        lock_version: 9,
        values: {
          constitution: "partnership",
          requested_amount: 500_000,
          requested_tenure_months: 6,
          purpose: "working_capital",
          referral_code: null,
        },
        business_profile: completeProfile,
        parties: [
          {
            ...primary,
            full_name: "Anita Rao",
            type_of_residence: "owned",
            employment_status_code: "self_employed",
            identifiers: { pan_masked: null, aadhaar_masked: "XXXX XXXX 1234" },
          },
          coApplicant,
        ],
      }),
    );
    render(<WizardShell locale="en" steps={steps} />);

    await screen.findByRole("heading", { name: "PAN verification" });
    changeField(`pan_number_${primary.party_id}`, "ABCDE1234F");
    changeField("entity_pan", "LMNOP9012Q");
    fireEvent.click(screen.getByRole("checkbox", { name: "PAN consent" }));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(await screen.findByText("Confirm the PAN number")).toBeVisible();
    expect(screen.getByText("Confirm the Business PAN")).toBeVisible();
    expect(api.savePanIdentity).not.toHaveBeenCalled();
    expect(api.saveEntityPan).not.toHaveBeenCalled();
  });

  it("requires a matching GSTIN confirmation and explicit GST consent", async () => {
    const primary = snapshot().parties[0];
    api.fetchCurrentApplication.mockResolvedValue(
      snapshot({
        lock_version: 9,
        business_profile: { ...completeProfile, gst_registered: true },
        parties: [
          {
            ...primary,
            full_name: "Anita Rao",
            type_of_residence: "owned",
            employment_status_code: "self_employed",
            identifiers: { pan_masked: "ABCDE***4F", aadhaar_masked: "XXXX XXXX 1234" },
          },
        ],
      }),
    );
    render(<WizardShell locale="en" steps={steps} />);

    await screen.findByRole("heading", { name: "GST verification" });
    changeField("gstin", "27ABCDE1234F1Z5");
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(await screen.findByText("Confirm the GSTIN")).toBeVisible();
    expect(screen.getByText("Please accept the GST consent")).toBeVisible();
    expect(api.saveGstRegistration).not.toHaveBeenCalled();
  });
});
