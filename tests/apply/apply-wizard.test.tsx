import React from "react";
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WizardShell } from "@/app/apply/_components/WizardShell";

const defaultSteps = [
  { id: "loan_intent", title: "Loan intent" },
  { id: "personal_contact", title: "Personal contact" },
  { id: "aadhaar_verification", title: "Aadhaar verification" },
  { id: "pan_verification", title: "PAN verification" },
  { id: "gst_verification", title: "GST verification" },
  { id: "itr_upload", title: "ITR upload" },
  { id: "bank_statements", title: "Bank statements" },
  { id: "review_submit", title: "Review & submit" },
  { id: "submission_result", title: "Submission result" },
] as const;

function renderWizard(props = {}) {
  return render(
    <WizardShell
      locale="en"
      steps={[...defaultSteps]}
      initialStepId="loan_intent"
      {...props}
    />
  );
}

describe("Apply wizard flow", () => {
  it("renders the first step loan_intent by default", () => {
    renderWizard();
    expect(screen.getByText(/loan intent/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /continue/i })
    ).toBeInTheDocument();
  });

  it("disables Continue until loan_intent fields become valid", async () => {
    const user = userEvent.setup();
    renderWizard();

    const continueButton = screen.getByRole("button", { name: /continue/i });
    expect(continueButton).toBeDisabled();

    const amountInput = screen.getByLabelText(/loan amount/i);
    const tenureInput = screen.getByLabelText(/tenure/i);
    const purposeInput = screen.getByLabelText(/purpose/i);

    await user.clear(amountInput);
    await user.type(amountInput, "500000");
    await user.clear(tenureInput);
    await user.type(tenureInput, "6");
    await user.selectOptions(purposeInput, "working_capital");

    await waitFor(() => expect(continueButton).toBeEnabled());
  });

  it("advances to personal_contact after valid loan_intent", async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.type(screen.getByLabelText(/loan amount/i), "500000");
    await user.type(screen.getByLabelText(/tenure/i), "6");
    await user.selectOptions(screen.getByLabelText(/purpose/i), "working_capital");

    const continueButton = screen.getByRole("button", { name: /continue/i });
    await waitFor(() => expect(continueButton).toBeEnabled());
    await user.click(continueButton);

    await waitFor(() =>
      expect(screen.getByText(/personal contact/i)).toBeInTheDocument()
    );
  });

  it("shows validation errors for invalid mobile, email, pin code", async () => {
    const user = userEvent.setup();
    renderWizard({ initialStepId: "personal_contact" });

    await user.type(screen.getByLabelText(/full name/i), "A");
    await user.type(screen.getByLabelText(/mobile/i), "12345");
    await user.type(screen.getByLabelText(/email/i), "not-an-email");
    await user.type(screen.getByLabelText(/pin code/i), "000000");

    const continueButton = screen.getByRole("button", { name: /continue/i });
    await user.click(continueButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid mobile/i)).toBeInTheDocument();
      expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
      expect(screen.getByText(/invalid pin code/i)).toBeInTheDocument();
    });
  });

  it("disables Continue on Aadhaar step until consent is accepted", async () => {
    const user = userEvent.setup();
    renderWizard({ initialStepId: "aadhaar_verification" });

    const continueButton = screen.getByRole("button", { name: /continue/i });
    expect(continueButton).toBeDisabled();

    await user.type(screen.getByLabelText(/aadhaar/i), "123456789012");

    const consentCheckbox = screen.getByRole("checkbox", {
      name: /aadhaar consent/i,
    });
    await user.click(consentCheckbox);

    await waitFor(() => expect(continueButton).toBeEnabled());
  });

  it("requires valid 12-digit Aadhaar", async () => {
    const user = userEvent.setup();
    renderWizard({ initialStepId: "aadhaar_verification" });

    const aadhaarInput = screen.getByLabelText(/aadhaar/i);
    await user.type(aadhaarInput, "12345");

    const consentCheckbox = screen.getByRole("checkbox", {
      name: /aadhaar consent/i,
    });
    await user.click(consentCheckbox);

    const continueButton = screen.getByRole("button", { name: /continue/i });
    await user.click(continueButton);

    await waitFor(() =>
      expect(screen.getByText(/invalid aadhaar/i)).toBeInTheDocument()
    );
  });

  it("requires valid uppercase PAN", async () => {
    const user = userEvent.setup();
    renderWizard({ initialStepId: "pan_verification" });

    const panInput = screen.getByLabelText(/pan/i);
    await user.type(panInput, "abcde1234f");

    const consentCheckbox = screen.getByRole("checkbox", {
      name: /pan consent/i,
    });
    await user.click(consentCheckbox);

    const continueButton = screen.getByRole("button", { name: /continue/i });
    await user.click(continueButton);

    await waitFor(() =>
      expect(screen.getByText(/invalid pan/i)).toBeInTheDocument()
    );
  });

  it("requires valid GSTIN or explicit skip", async () => {
    const user = userEvent.setup();
    renderWizard({ initialStepId: "gst_verification" });

    const registeredRadio = screen.getByRole("radio", { name: /registered/i });
    await user.click(registeredRadio);

    await user.type(screen.getByLabelText(/gstin/i), "invalid-gstin");

    const continueButton = screen.getByRole("button", { name: /continue/i });
    await user.click(continueButton);

    await waitFor(() =>
      expect(screen.getByText(/invalid gstin/i)).toBeInTheDocument()
    );

    const skipButton = screen.getByRole("button", { name: /skip/i });
    await user.click(skipButton);

    await waitFor(() =>
      expect(screen.getByText(/itr upload/i)).toBeInTheDocument()
    );
  });

  it("blocks ITR step until valid PDF is selected", async () => {
    const user = userEvent.setup();
    renderWizard({ initialStepId: "itr_upload" });

    const continueButton = screen.getByRole("button", { name: /continue/i });
    expect(continueButton).toBeDisabled();

    const fileInput = screen.getByLabelText(/upload itr/i);
    const file = new File(["%PDF-1.4"], "itr.pdf", { type: "application/pdf" });
    await user.upload(fileInput, file);

    const consentCheckbox = screen.getByRole("checkbox", {
      name: /itr consent/i,
    });
    await user.click(consentCheckbox);

    await waitFor(() => expect(continueButton).toBeEnabled());
  });

  it("blocks bank_statements step until Perfios link and consent accepted", async () => {
    const user = userEvent.setup();
    renderWizard({ initialStepId: "bank_statements" });

    const continueButton = screen.getByRole("button", { name: /continue/i });
    expect(continueButton).toBeDisabled();

    const linkButton = screen.getByRole("button", { name: /link bank/i });
    await user.click(linkButton);

    const consentCheckbox = screen.getByRole("checkbox", {
      name: /bank statement consent/i,
    });
    await user.click(consentCheckbox);

    await waitFor(() => expect(continueButton).toBeEnabled());
  });

  it("displays masked PII on review step and requires consents", async () => {
    const user = userEvent.setup();
    renderWizard({
      initialStepId: "review_submit",
      initialValues: {
        loan_amount: 500000,
        tenure_months: 6,
        purpose: "working_capital",
        full_name: "Amit Sharma",
        mobile_number: "9876543210",
        email: "amit@example.com",
        business_pin_code: "110001",
        aadhaar_number: "123456789012",
        pan_number: "ABCDE1234F",
        gstin: "27AAPFU0939F1ZV",
      },
    });

    expect(screen.getByText(/XXXXXX1234/)).toBeInTheDocument();
    expect(screen.getByText(/XXXX XXXX 9012/)).toBeInTheDocument();
    expect(screen.getByText(/ABCXX\*\*\*X/)).toBeInTheDocument();
    expect(screen.getByText(/27AAPFU0939F1ZV/)).toBeInTheDocument();

    const submitButton = screen.getByRole("button", { name: /submit/i });
    expect(submitButton).toBeDisabled();

    const checkboxes = screen.getAllByRole("checkbox");
    for (const checkbox of checkboxes) {
      await user.click(checkbox);
    }

    await waitFor(() => expect(submitButton).toBeEnabled());
  });

  it("shows reference number on submission_result step after success", async () => {
    renderWizard({
      initialStepId: "submission_result",
      submissionResult: {
        outcome: "submitted_success",
        reference_number: "NDH-20260618-A1B2C3",
        next_step: "offers",
      },
    });

    expect(screen.getByText(/NDH-20260618-A1B2C3/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /view dashboard/i })
    ).toBeInTheDocument();
  });
});
