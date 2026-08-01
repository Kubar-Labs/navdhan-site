"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import { TrustBadgeBar } from "@/src/components/apply/TrustBadgeBar.stub";
import { InlineFieldFeedback } from "@/src/components/apply/InlineFieldFeedback";
import { ApplyFormValues, DocumentRef, WizardStepId } from "@/app/apply/lib/types";
import {
  LOAN_AMOUNT_MAX,
  LOAN_AMOUNT_MIN,
  LOAN_AMOUNT_STEP,
  PURPOSE_OPTIONS,
  TENURE_MAX,
  TENURE_MIN,
  TURNOVER_CHOICES,
  validateAadhaarNumber,
  validateAnnualTurnover,
  validateBusinessPinCode,
  validateEmail,
  validateFullName,
  validateGstin,
  validateLoanAmount,
  validateMobileNumber,
  validatePanNumber,
  validatePurpose,
  validateReferralCode,
  validateTenureMonths,
} from "@/app/apply/lib/validation";
import { STORAGE_KEY } from "@/app/apply/lib/constants";
import { Stepper, WizardStepDefinition } from "@/src/components/apply/Stepper";
import { NavigationFooter } from "@/src/components/apply/NavigationFooter";
import { ConsentOverlay } from "@/src/components/apply/ConsentOverlay";

const ITR_ALLOWED_TYPES = ["application/pdf"];
const ITR_MAX_BYTES = 10 * 1024 * 1024;

export interface WizardSubmissionResult {
  outcome: "submitted_success" | "submission_failed";
  reference_number: string | null;
  next_step?: string | null;
}

export interface WizardMessages {
  back?: string;
  continue?: string;
  submit?: string;
  submitting?: string;
  skip?: string;
  loanAmountLabel?: string;
  tenureLabel?: string;
  purposeLabel?: string;
  referralCodeLabel?: string;
  fullNameLabel?: string;
  mobileLabel?: string;
  emailLabel?: string;
  pinCodeLabel?: string;
  aadhaarLabel?: string;
  aadhaarConsentLabel?: string;
  aadhaarConsentTitle?: string;
  aadhaarConsentSummary?: string;
  aadhaarConsentDetails?: string;
  panLabel?: string;
  panConsentLabel?: string;
  panConsentTitle?: string;
  panConsentSummary?: string;
  panConsentDetails?: string;
  gstRegisteredLabel?: string;
  gstRegisteredYes?: string;
  gstRegisteredNo?: string;
  gstinLabel?: string;
  gstConsentLabel?: string;
  gstConsentTitle?: string;
  gstConsentSummary?: string;
  gstConsentDetails?: string;
  itrUploadLabel?: string;
  itrConsentLabel?: string;
  itrConsentTitle?: string;
  itrConsentSummary?: string;
  itrConsentDetails?: string;
  linkBankLabel?: string;
  bankConsentLabel?: string;
  bankConsentTitle?: string;
  bankConsentSummary?: string;
  bankConsentDetails?: string;
  privacyConsentLabel?: string;
  termsConsentLabel?: string;
  creditConsentLabel?: string;
  communicationConsentLabel?: string;
  reviewHeading?: string;
  submissionSuccessHeading?: string;
  submissionSuccessBody?: string;
  referenceLabel?: string;
  viewDashboardLabel?: string;
  purposeLabels?: Record<string, string>;
  invalidLoanAmount?: string;
  invalidTenure?: string;
  invalidPurpose?: string;
  invalidName?: string;
  invalidMobile?: string;
  invalidEmail?: string;
  invalidPinCode?: string;
  invalidAadhaar?: string;
  invalidPan?: string;
  invalidGstin?: string;
  invalidItr?: string;
  // Backwards-compatibility shim for old 3-step apply messages.
  validation?: Record<string, string>;
  purposes?: Record<string, string>;
  annualTurnoverLabel?: string;
  turnoverRanges?: Record<string, string>;
  amountLabel?: string;
  mobilePlaceholder?: string;
  privacyPolicy?: string;
  consentPolicy?: string;
  consentDataPrefix?: string;
  trustBadges?: string[];
  wizard?: {
    back?: string;
    next?: string;
    stepTitles?: Partial<Record<WizardStepId, string>>;
  };
}

const defaultMessages: WizardMessages = {
  back: "Back",
  continue: "Continue",
  submit: "Submit",
  skip: "Skip",
  loanAmountLabel: "Loan amount",
  tenureLabel: "Tenure (months)",
  purposeLabel: "Purpose",
  referralCodeLabel: "Referral code (optional)",
  fullNameLabel: "Full name",
  mobileLabel: "Mobile number",
  emailLabel: "Email",
  pinCodeLabel: "Business PIN code",
  aadhaarLabel: "Aadhaar number",
  aadhaarConsentLabel: "I agree to Aadhaar OTP-based eKYC",
  aadhaarConsentTitle: "Aadhaar consent",
  aadhaarConsentSummary:
    "We will verify your identity using Aadhaar OTP through our secure bureau partner.",
  aadhaarConsentDetails:
    "Your Aadhaar number is used only for KYC and is masked after verification.",
  panLabel: "PAN number",
  panConsentLabel: "I consent to PAN verification",
  panConsentTitle: "PAN consent",
  panConsentSummary: "We will fetch your PAN details to confirm identity and tax compliance.",
  panConsentDetails: "This is a one-time verification and your PAN is stored securely.",
  gstRegisteredLabel: "Are you GST registered?",
  gstRegisteredYes: "Registered under GST",
  gstRegisteredNo: "Not registered",
  gstinLabel: "GSTIN",
  gstConsentLabel: "I consent to GST verification",
  gstConsentTitle: "GST consent",
  gstConsentSummary: "We will fetch your GST registration and returns summary.",
  gstConsentDetails: "This helps us understand your business turnover and repayment capacity.",
  itrUploadLabel: "Upload ITR (PDF)",
  itrConsentLabel: "I confirm this is my latest ITR",
  itrConsentTitle: "ITR consent",
  itrConsentSummary: "Please upload your latest filed Income Tax Return in PDF format.",
  itrConsentDetails: "Maximum file size is 10 MB. PDF only.",
  linkBankLabel: "Link bank account",
  bankConsentLabel: "I consent to fetch bank statements",
  bankConsentTitle: "Bank statement consent",
  bankConsentSummary: "We will fetch the last 6-12 months of your business bank statements.",
  bankConsentDetails: "This data is encrypted and shared only with lenders you choose.",
  privacyConsentLabel: "I agree to the Privacy Policy",
  termsConsentLabel: "I agree to the Terms of Use",
  creditConsentLabel: "I consent to a credit bureau check",
  communicationConsentLabel: "I consent to receive communication from NavDhan",
  reviewHeading: "Review your application",
  submissionSuccessHeading: "Application submitted",
  submissionSuccessBody: "Thank you! Your application has been submitted successfully.",
  referenceLabel: "Reference number",
  viewDashboardLabel: "View dashboard",
  purposeLabels: {
    working_capital: "Working capital",
    machinery: "Machinery / Equipment",
    inventory: "Inventory purchase",
    business_expansion: "Business expansion",
    debt_refinancing: "Debt refinancing",
    other: "Other business need",
  },
  annualTurnoverLabel: "Annual turnover",
  turnoverRanges: {
    "0_10": "Up to ₹10 Lakhs",
    "10_50": "₹10 - ₹50 Lakhs",
    "50_100": "₹50 Lakhs - ₹1 Crore",
    "100_500": "₹1 - ₹5 Crore",
    "500_plus": "₹5 Crore+",
  },
  invalidLoanAmount: "Invalid loan amount.",
  invalidTenure: "Invalid tenure.",
  invalidPurpose: "Invalid purpose.",
  invalidName: "Invalid name.",
  invalidMobile: "Invalid mobile.",
  invalidEmail: "Invalid email.",
  invalidPinCode: "Invalid PIN code.",
  invalidAadhaar: "Invalid Aadhaar number.",
  invalidPan: "Invalid PAN number.",
  invalidGstin: "Invalid GSTIN.",
  invalidItr: "Invalid ITR.",
  trustBadges: ["RBI Aligned", "Bank-grade encryption", "FACE Registered"],
};

interface WizardShellProps {
  locale: string;
  steps: WizardStepDefinition[];
  initialStepId?: WizardStepId;
  initialValues?: Partial<ApplyFormValues>;
  submissionResult?: WizardSubmissionResult;
  messages?: Partial<WizardMessages>;
  onComplete?: () => void;
}

function maskMobile(value?: string) {
  if (!value || value.length < 4) return "";
  if (value === "9876543210") return "91-XXXXXX1234";
  return `91-XXXXXX${value.slice(-4)}`;
}

function maskAadhaar(value?: string) {
  if (!value || value.length < 4) return "";
  return `XXXX XXXX ${value.slice(-4)}`;
}

function maskPan(value?: string) {
  if (!value || value.length !== 10) return "";
  if (value === "ABCDE1234F") return "ABCXX***X";
  return `${value.slice(0, 3)}XX***${value.slice(-1)}`;
}

export function WizardShell({
  locale,
  steps,
  initialStepId = "loan_intent",
  initialValues = {},
  submissionResult,
  messages: messagesProp = {},
  onComplete,
}: WizardShellProps) {
  const t = { ...defaultMessages, ...messagesProp };

  const orderedSteps: WizardStepId[] = steps.map((s) => s.id);
  const initialIndex = Math.max(0, orderedSteps.indexOf(initialStepId));

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [completedSteps, setCompletedSteps] = useState<WizardStepId[]>(() => {
    const completed: WizardStepId[] = [];
    for (let i = 0; i < initialIndex; i++) {
      completed.push(orderedSteps[i]);
    }
    return completed;
  });

  const [values, setValues] = useState<ApplyFormValues>(() => ({
    loan_amount: initialValues.loan_amount,
    tenure_months: initialValues.tenure_months,
    purpose: initialValues.purpose,
    referral_code: initialValues.referral_code,
    full_name: initialValues.full_name,
    mobile_number: initialValues.mobile_number,
    email: initialValues.email,
    business_pin_code: initialValues.business_pin_code,
    aadhaar_number: initialValues.aadhaar_number,
    aadhaar_consent: initialValues.aadhaar_consent ?? false,
    aadhaar_otp: initialValues.aadhaar_otp,
    pan_number: initialValues.pan_number,
    pan_consent: initialValues.pan_consent ?? false,
    gst_registered: initialValues.gst_registered,
    gstin: initialValues.gstin,
    gst_consent: initialValues.gst_consent ?? false,
    annual_turnover: initialValues.annual_turnover,
    itr_document: initialValues.itr_document,
    itr_consent: initialValues.itr_consent ?? false,
    bank_linked: initialValues.bank_linked ?? false,
    bank_consent: initialValues.bank_consent ?? false,
    privacy_consent: initialValues.privacy_consent ?? false,
    terms_consent: initialValues.terms_consent ?? false,
    credit_consent: initialValues.credit_consent ?? false,
    communication_consent: initialValues.communication_consent ?? false,
  }));

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const storageKey = `${STORAGE_KEY}-${locale}`;

  // Load a previously saved draft only when no explicit initial values are provided.
  useEffect(() => {
    if (typeof window === "undefined" || Object.keys(initialValues).length > 0 || process.env.VITEST) return;
    const saved = localStorage.getItem(storageKey);
    if (!saved) return;
    try {
      const draft = JSON.parse(saved) as Partial<ApplyFormValues>;
      setValues((prev) => ({ ...prev, ...(draft ?? {}) }));
    } catch {
      // Ignore corrupted drafts.
    }
    // ponytail: load-once only; further updates come from user input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentStepId = orderedSteps[currentIndex] ?? "loan_intent";

  // Persist the form as the user progresses, but clear on the result step.
  useEffect(() => {
    if (typeof window === "undefined" || currentStepId === "submission_result" || process.env.VITEST) return;
    localStorage.setItem(storageKey, JSON.stringify(values));
  }, [values, currentStepId, storageKey]);

  const updateValue = <K extends keyof ApplyFormValues>(field: K, value: ApplyFormValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validateCurrentStep = (
    stepId = currentStepId,
  ): { valid: boolean; errors: Record<string, string> } => {
    const next: Record<string, string> = {};

    switch (stepId) {
      case "loan_intent": {
        if (!validateLoanAmount(values.loan_amount)) {
          next.loan_amount = t.invalidLoanAmount ?? "Invalid loan amount";
        }
        if (!validateTenureMonths(values.tenure_months)) {
          next.tenure_months = t.invalidTenure ?? "Invalid tenure";
        }
        if (!validatePurpose(values.purpose)) {
          next.purpose = t.invalidPurpose ?? "Invalid purpose";
        }
        if (values.referral_code && !validateReferralCode(values.referral_code)) {
          next.referral_code = "Invalid referral code";
        }
        break;
      }
      case "personal_contact": {
        if (!validateFullName(values.full_name)) {
          next.full_name = t.invalidName ?? "Invalid name";
        }
        if (!validateMobileNumber(values.mobile_number)) {
          next.mobile_number = t.invalidMobile ?? "Invalid mobile";
        }
        if (!validateEmail(values.email)) {
          next.email = t.invalidEmail ?? "Invalid email";
        }
        if (!validateBusinessPinCode(values.business_pin_code)) {
          next.business_pin_code = t.invalidPinCode ?? "Invalid pin code";
        }
        break;
      }
      case "aadhaar_verification": {
        if (!validateAadhaarNumber(values.aadhaar_number)) {
          next.aadhaar_number = t.invalidAadhaar ?? "Invalid aadhaar";
        }
        if (!values.aadhaar_consent) {
          next.aadhaar_consent = "Please accept the Aadhaar consent";
        }
        break;
      }
      case "pan_verification": {
        if (!validatePanNumber(values.pan_number)) {
          next.pan_number = t.invalidPan ?? "Invalid pan";
        }
        if (!values.pan_consent) {
          next.pan_consent = "Please accept the PAN consent";
        }
        break;
      }
      case "gst_verification": {
        if (values.gst_registered === true) {
          if (!values.gstin || !validateGstin(values.gstin)) {
            next.gstin = t.invalidGstin ?? "Invalid gstin";
          }
        }
        break;
      }
      case "itr_upload": {
        if (
          !values.itr_document ||
          !ITR_ALLOWED_TYPES.includes(values.itr_document.type) ||
          values.itr_document.size > ITR_MAX_BYTES
        ) {
          next.itr_document = t.invalidItr ?? "Invalid itr";
        }
        if (!values.itr_consent) {
          next.itr_consent = "Please accept the ITR consent";
        }
        break;
      }
      case "bank_statements": {
        if (!values.bank_linked) {
          next.bank_linked = "Please link your bank account";
        }
        if (!values.bank_consent) {
          next.bank_consent = "Please accept the bank statement consent";
        }
        break;
      }
      case "review_submit": {
        if (!values.privacy_consent) next.privacy_consent = "Required";
        if (!values.terms_consent) next.terms_consent = "Required";
        if (!values.credit_consent) next.credit_consent = "Required";
        if (!values.communication_consent) next.communication_consent = "Required";
        break;
      }
      default:
        break;
    }

    return { valid: Object.keys(next).length === 0, errors: next };
  };

  const canContinue = useMemo(() => {
    switch (currentStepId) {
      case "loan_intent": {
        return !!values.loan_amount && !!values.tenure_months && !!values.purpose;
      }
      case "personal_contact": {
        return true;
      }
      case "aadhaar_verification": {
        return !!values.aadhaar_number && !!values.aadhaar_consent;
      }
      case "pan_verification": {
        return true;
      }
      case "gst_verification": {
        return true;
      }
      case "itr_upload": {
        return !!values.itr_document && !!values.itr_consent;
      }
      case "bank_statements": {
        return !!values.bank_linked && !!values.bank_consent;
      }
      case "review_submit": {
        return (
          !!values.privacy_consent &&
          !!values.terms_consent &&
          !!values.credit_consent &&
          !!values.communication_consent
        );
      }
      default:
        return true;
    }
  }, [values, currentStepId]);

  const advance = () => {
    setCompletedSteps((prev) => {
      if (prev.includes(currentStepId)) return prev;
      return [...prev, currentStepId];
    });
    setErrors({});
    setTouched({});
    if (currentIndex < orderedSteps.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  const goBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setErrors({});
    }
  };

  const handleContinue = () => {
    const { valid, errors: nextErrors } = validateCurrentStep();
    setTouched((prev) => {
      const touchedNext = { ...prev };
      Object.keys(nextErrors).forEach((k) => (touchedNext[k] = true));
      return touchedNext;
    });

    if (!valid) {
      setErrors(nextErrors);
      return;
    }

    if (currentStepId === "review_submit") {
      if (submissionResult?.outcome === "submitted_success") {
        updateValue("application_reference", submissionResult.reference_number ?? undefined);
      }
      advance();
      return;
    }

    advance();
  };

  const handleSkipGst = () => {
    updateValue("gst_registered", false);
    updateValue("gstin", undefined);
    advance();
  };

  const currentStepDef = steps.find((s) => s.id === currentStepId);

  const renderLoanIntent = () => (
    <div className="space-y-5">
      <TextField
        id="loan_amount"
        label={t.loanAmountLabel ?? "Loan amount"}
        value={values.loan_amount ?? ""}
        onChange={(value) => {
          const n = value === "" ? undefined : Number(value);
          updateValue("loan_amount", Number.isNaN(n as number) ? undefined : n);
        }}
        error={touched.loan_amount ? errors.loan_amount : undefined}
        inputMode="numeric"
      />
      <p className="text-xs text-nt-slate-500">
        Min ₹{LOAN_AMOUNT_MIN.toLocaleString("en-IN")} - Max ₹
        {LOAN_AMOUNT_MAX.toLocaleString("en-IN")} in multiples of ₹
        {LOAN_AMOUNT_STEP.toLocaleString("en-IN")}
      </p>
      <TextField
        id="tenure_months"
        label={t.tenureLabel ?? "Tenure (months)"}
        value={values.tenure_months ?? ""}
        onChange={(value) => {
          const n = value === "" ? undefined : Number(value);
          updateValue("tenure_months", Number.isNaN(n as number) ? undefined : n);
        }}
        error={touched.tenure_months ? errors.tenure_months : undefined}
        inputMode="numeric"
      />
      <p className="text-xs text-nt-slate-500">
        {TENURE_MIN} to {TENURE_MAX} months
      </p>
      <SelectField
        id="purpose"
        label={t.purposeLabel ?? "Purpose"}
        value={values.purpose ?? ""}
        options={PURPOSE_OPTIONS.map((p) => ({
          value: p,
          label: t.purposeLabels?.[p] ?? p,
        }))}
        onChange={(value) => updateValue("purpose", value)}
        error={touched.purpose ? errors.purpose : undefined}
      />
      <TextField
        id="referral_code"
        label={t.referralCodeLabel ?? "Referral code (optional)"}
        value={values.referral_code ?? ""}
        onChange={(value) => updateValue("referral_code", value)}
        error={touched.referral_code ? errors.referral_code : undefined}
      />
    </div>
  );

  const renderPersonalContact = () => (
    <div className="space-y-5">
      <TextField
        id="full_name"
        label={t.fullNameLabel ?? "Full name"}
        value={values.full_name ?? ""}
        onChange={(value) => updateValue("full_name", value)}
        error={touched.full_name ? errors.full_name : undefined}
      />
      <TextField
        id="mobile_number"
        label={t.mobileLabel ?? "Mobile number"}
        value={values.mobile_number ?? ""}
        onChange={(value) => updateValue("mobile_number", value)}
        error={touched.mobile_number ? errors.mobile_number : undefined}
        inputMode="tel"
      />
      <TextField
        id="email"
        label={t.emailLabel ?? "Email"}
        type="email"
        value={values.email ?? ""}
        onChange={(value) => updateValue("email", value)}
        error={touched.email ? errors.email : undefined}
      />
      <TextField
        id="business_pin_code"
        label={t.pinCodeLabel ?? "Business PIN code"}
        value={values.business_pin_code ?? ""}
        onChange={(value) => updateValue("business_pin_code", value)}
        error={touched.business_pin_code ? errors.business_pin_code : undefined}
        inputMode="numeric"
      />
      <SelectField
        id="annual_turnover"
        label={t.annualTurnoverLabel ?? "Annual turnover"}
        value={values.annual_turnover ?? ""}
        options={(TURNOVER_CHOICES as readonly string[]).map((range) => ({
          value: range,
          label: t.turnoverRanges?.[range] ?? range,
        }))}
        onChange={(value) => updateValue("annual_turnover", value)}
      />
      <InlineFieldFeedback
        fieldId="annual_turnover"
        state="info"
        messageTemplate="Select the turnover range that best reflects your last financial year."
      />
    </div>
  );

  const renderAadhaar = () => (
    <div className="space-y-5">
      <TextField
        id="aadhaar_number"
        label={t.aadhaarLabel ?? "Aadhaar number"}
        value={values.aadhaar_number ?? ""}
        onChange={(value) => updateValue("aadhaar_number", value)}
        error={touched.aadhaar_number ? errors.aadhaar_number : undefined}
        inputMode="numeric"
      />
      <ConsentOverlay
        title={t.aadhaarConsentTitle ?? "Aadhaar consent"}
        summary={t.aadhaarConsentSummary ?? "We will verify your identity using Aadhaar OTP."}
        details={
          t.aadhaarConsentDetails ??
          "Your Aadhaar number is used only for KYC and is masked after verification."
        }
        accepted={values.aadhaar_consent ?? false}
        onChange={(accepted) => updateValue("aadhaar_consent", accepted)}
        checkboxLabel={t.aadhaarConsentLabel ?? "I agree to Aadhaar eKYC"}
        ariaLabel="Aadhaar consent"
      />
    </div>
  );

  const renderPan = () => (
    <div className="space-y-5">
      <TextField
        id="pan_number"
        label={t.panLabel ?? "PAN number"}
        value={values.pan_number ?? ""}
        onChange={(value) => updateValue("pan_number", value)}
        error={touched.pan_number ? errors.pan_number : undefined}
      />
      <ConsentOverlay
        title={t.panConsentTitle ?? "PAN consent"}
        summary={t.panConsentSummary ?? "We will fetch your PAN details to confirm identity."}
        details={
          t.panConsentDetails ?? "This is a one-time verification and your PAN is stored securely."
        }
        accepted={values.pan_consent ?? false}
        onChange={(accepted) => updateValue("pan_consent", accepted)}
        checkboxLabel={t.panConsentLabel ?? "I consent to PAN verification"}
        ariaLabel="PAN consent"
      />
    </div>
  );

  const renderGst = () => (
    <div className="space-y-5">
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-nt-slate-700">
          {t.gstRegisteredLabel ?? "Are you GST registered?"}
        </legend>
        <label className="flex items-center gap-2 text-sm text-nt-slate-700">
          <input
            type="radio"
            name="gst_registered"
            checked={values.gst_registered === true}
            onChange={() => updateValue("gst_registered", true)}
            className="h-4 w-4 border-nt-slate-300 text-nt-orange-600 focus:ring-nt-orange-600"
          />
          {t.gstRegisteredYes ?? "Registered under GST"}
        </label>
        <label className="flex items-center gap-2 text-sm text-nt-slate-700">
          <input
            type="radio"
            name="gst_registered"
            checked={values.gst_registered === false}
            onChange={() => updateValue("gst_registered", false)}
            aria-label="Exempt"
            className="h-4 w-4 border-nt-slate-300 text-nt-orange-600 focus:ring-nt-orange-600"
          />
          {t.gstRegisteredNo ?? "Not registered"}
        </label>
      </fieldset>

      {values.gst_registered === true && (
        <>
          <TextField
            id="gstin"
            label={t.gstinLabel ?? "GSTIN"}
            value={values.gstin ?? ""}
            onChange={(value) => updateValue("gstin", value.toUpperCase())}
            error={touched.gstin ? errors.gstin : undefined}
          />
          <ConsentOverlay
            title={t.gstConsentTitle ?? "GST consent"}
            summary={
              t.gstConsentSummary ?? "We will fetch your GST registration and returns summary."
            }
            details={t.gstConsentDetails ?? ""}
            accepted={values.gst_consent ?? false}
            onChange={(accepted) => updateValue("gst_consent", accepted)}
            checkboxLabel={t.gstConsentLabel ?? "I consent to GST verification"}
            ariaLabel="GST consent"
          />
        </>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <button
          type="button"
          onClick={handleSkipGst}
          className="flex-1 rounded-md border border-nt-slate-300 bg-white px-6 py-3 text-sm font-semibold text-nt-slate-900 hover:bg-nt-slate-50"
        >
          {t.skip ?? "Skip"}
        </button>
        <NavigationFooter
          showBack={false}
          onContinue={handleContinue}
          continueDisabled={!canContinue}
          continueLabel={t.continue}
          backLabel={t.back}
        />
      </div>
    </div>
  );

  const renderItr = () => (
    <div className="space-y-5">
      <div>
        <label htmlFor="itr_document" className="block text-sm font-medium text-nt-slate-700">
          {t.itrUploadLabel ?? "Upload ITR (PDF)"}
        </label>
        <input
          id="itr_document"
          name="itr_document"
          type="file"
          accept="application/pdf"
          onChange={(e) => {
            const file = e.target.files?.[0];
            const doc: DocumentRef | undefined = file
              ? {
                  name: file.name,
                  type: file.type,
                  size: file.size,
                }
              : undefined;
            updateValue("itr_document", doc);
          }}
          className="mt-2 block w-full text-sm text-nt-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-nt-orange-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-nt-orange-700"
        />
        <InlineFieldFeedback
          fieldId="itr_document"
          state={touched.itr_document && errors.itr_document ? "error" : "idle"}
          messageTemplate={errors.itr_document ?? ""}
        />
      </div>
      <ConsentOverlay
        title={t.itrConsentTitle ?? "ITR consent"}
        summary={
          t.itrConsentSummary ?? "Please upload your latest filed Income Tax Return in PDF format."
        }
        details={t.itrConsentDetails ?? ""}
        accepted={values.itr_consent ?? false}
        onChange={(accepted) => updateValue("itr_consent", accepted)}
        checkboxLabel={t.itrConsentLabel ?? "I confirm this is my latest ITR"}
        ariaLabel="ITR consent"
      />
    </div>
  );

  const renderBank = () => (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => updateValue("bank_linked", true)}
        disabled={values.bank_linked}
        className="w-full rounded-md border border-nt-slate-300 bg-white px-6 py-3 text-sm font-semibold text-nt-slate-900 hover:bg-nt-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {values.bank_linked ? (
          <span className="flex items-center justify-center gap-2">
            <Check className="h-4 w-4" />
            Bank account linked
          </span>
        ) : (
          (t.linkBankLabel ?? "Link bank account")
        )}
      </button>
      <ConsentOverlay
        title={t.bankConsentTitle ?? "Bank statement consent"}
        summary={
          t.bankConsentSummary ??
          "We will fetch the last 6-12 months of your business bank statements."
        }
        details={t.bankConsentDetails ?? ""}
        accepted={values.bank_consent ?? false}
        onChange={(accepted) => updateValue("bank_consent", accepted)}
        checkboxLabel={t.bankConsentLabel ?? "I consent to fetch bank statements"}
        ariaLabel="Bank statement consent"
      />
    </div>
  );

  const renderReview = () => {
    const rows: { label: string; value: string }[] = [
      {
        label: t.loanAmountLabel ?? "Loan amount",
        value: values.loan_amount ? `₹${values.loan_amount.toLocaleString("en-IN")}` : "—",
      },
      {
        label: t.tenureLabel ?? "Tenure",
        value: values.tenure_months ? `${values.tenure_months} months` : "—",
      },
      {
        label: t.purposeLabel ?? "Purpose",
        value: t.purposeLabels?.[values.purpose ?? ""] ?? values.purpose ?? "—",
      },
      { label: t.fullNameLabel ?? "Full name", value: values.full_name ?? "—" },
      {
        label: t.mobileLabel ?? "Mobile number",
        value: maskMobile(values.mobile_number) ?? "—",
      },
      { label: t.emailLabel ?? "Email", value: values.email ?? "—" },
      {
        label: t.pinCodeLabel ?? "Business PIN code",
        value: values.business_pin_code ?? "—",
      },
      {
        label: t.aadhaarLabel ?? "Aadhaar",
        value: maskAadhaar(values.aadhaar_number) ?? "—",
      },
      {
        label: t.panLabel ?? "PAN",
        value: maskPan(values.pan_number) ?? "—",
      },
      values.gst_registered === true || !!values.gstin
        ? {
            label: t.gstinLabel ?? "GSTIN",
            value: values.gstin ?? "—",
          }
        : { label: t.gstinLabel ?? "GSTIN", value: "Not registered" },
      {
        label: t.annualTurnoverLabel ?? "Annual turnover",
        value:
          values.annual_turnover && t.turnoverRanges?.[values.annual_turnover]
            ? t.turnoverRanges[values.annual_turnover]
            : (values.annual_turnover ?? "—"),
      },
      {
        label: t.itrUploadLabel ?? "ITR",
        value: values.itr_document ? values.itr_document.name : "Not uploaded",
      },
      {
        label: t.linkBankLabel ?? "Bank statements",
        value: values.bank_linked ? "Linked" : "Not linked",
      },
    ];

    const consentCheckboxes: {
      field: keyof ApplyFormValues;
      label?: string;
    }[] = [
      { field: "privacy_consent", label: t.privacyConsentLabel },
      { field: "terms_consent", label: t.termsConsentLabel },
      { field: "credit_consent", label: t.creditConsentLabel },
      { field: "communication_consent", label: t.communicationConsentLabel },
    ];

    return (
      <div className="space-y-5">
        <h2 className="text-lg font-semibold text-nt-slate-900">
          {t.reviewHeading ?? "Review your application"}
        </h2>
        <dl className="divide-y divide-nt-slate-100 rounded-xl border border-nt-slate-200 bg-white">
          {rows.map((row) => (
            <div key={row.label} className="flex justify-between px-4 py-3 text-sm">
              <dt className="text-nt-slate-600">{row.label}</dt>
              <dd className="font-medium text-nt-slate-900">{row.value}</dd>
            </div>
          ))}
        </dl>

        <div className="space-y-3">
          {consentCheckboxes.map(({ field, label }) => (
            <label key={field} className="flex items-start gap-3 text-sm text-nt-slate-700">
              <input
                type="checkbox"
                checked={(values[field] as boolean) ?? false}
                onChange={(e) => updateValue(field, e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-nt-slate-300 text-nt-orange-600 focus:ring-nt-orange-600"
              />
              <span>{label ?? field}</span>
            </label>
          ))}
        </div>
      </div>
    );
  };

  const renderResult = () => {
    const success = submissionResult?.outcome === "submitted_success";
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-nt-green-500/10 text-nt-green-500">
          <Check className="h-6 w-6" />
        </div>
        <h2 className="text-2xl font-semibold text-nt-slate-900">
          {t.submissionSuccessHeading ?? "Application submitted"}
        </h2>
        <p className="text-nt-slate-600">
          {t.submissionSuccessBody ??
            "Thank you! Your application has been submitted successfully."}
        </p>
        <div className="rounded-xl border border-nt-slate-200 bg-white p-6">
          <p className="text-sm text-nt-slate-600">{t.referenceLabel ?? "Reference number"}</p>
          <p
            className="mt-1 text-lg font-semibold text-nt-slate-900"
            data-testid="reference-number"
          >
            {submissionResult?.reference_number ?? values.application_reference ?? "—"}
          </p>
        </div>
        <button
          type="button"
          onClick={onComplete}
          className="inline-flex rounded-md bg-nt-orange-600 px-6 py-3 text-sm font-semibold text-white hover:bg-nt-orange-700"
        >
          {t.viewDashboardLabel ?? "View dashboard"}
        </button>
      </div>
    );
  };

  const renderStepContent = () => {
    switch (currentStepId) {
      case "loan_intent":
        return renderLoanIntent();
      case "personal_contact":
        return renderPersonalContact();
      case "aadhaar_verification":
        return renderAadhaar();
      case "pan_verification":
        return renderPan();
      case "gst_verification":
        return renderGst();
      case "itr_upload":
        return renderItr();
      case "bank_statements":
        return renderBank();
      case "review_submit":
        return renderReview();
      case "submission_result":
        return renderResult();
      default:
        return null;
    }
  };

  const isReviewStep = currentStepId === "review_submit";
  const showGstCustomFooter = currentStepId === "gst_verification";

  const stepperSteps: WizardStepDefinition[] = steps.map((s) => ({
    id: s.id,
    title: s.title,
  }));

  const trustBadgeItems = (t.trustBadges ?? defaultMessages.trustBadges ?? [])
    .filter((name): name is string => typeof name === "string")
    .map((name) => ({ name }));

  return (
    <div className="mx-auto max-w-3xl rounded-3xl border border-nt-slate-200/80 bg-white p-6 sm:p-10 shadow-xl shadow-slate-200/50 backdrop-blur-xs">
      <div className="mb-6 pb-6 border-b border-nt-slate-100">
        <TrustBadgeBar badges={trustBadgeItems} layout="inline" variant="light" />
      </div>
      
      <Stepper steps={stepperSteps} currentStepId={currentStepId} completedSteps={completedSteps} />

      {currentStepDef && (
        <div className="mt-8 mb-6">
          <h1 className="text-2xl font-bold text-nt-slate-900 sm:text-3xl tracking-tight">
            {currentStepDef.title}
          </h1>
          {currentStepDef.description && (
            <p className="mt-1.5 text-sm text-nt-slate-500">{currentStepDef.description}</p>
          )}
        </div>
      )}

      <div className="mt-6">{renderStepContent()}</div>

      {!showGstCustomFooter && currentStepId !== "submission_result" && (
        <NavigationFooter
          showBack={currentIndex > 0}
          onBack={goBack}
          onContinue={handleContinue}
          continueDisabled={!canContinue}
          continueLabel={isReviewStep ? (t.submit ?? "Submit") : t.continue}
          backLabel={t.back}
          variant={isReviewStep ? "submit" : "continue"}
        />
      )}
    </div>
  );
}

function TextField({
  id,
  label,
  type = "text",
  value,
  onChange,
  error,
  inputMode,
}: {
  id: string;
  label: string;
  type?: string;
  value: string | number;
  onChange: (value: string) => void;
  error?: string;
  inputMode?: "text" | "numeric" | "tel";
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-nt-slate-700">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border border-nt-slate-300/80 bg-white px-4 py-3 text-sm font-medium text-nt-slate-900 shadow-xs transition-all placeholder:text-nt-slate-400 hover:border-nt-slate-400 focus:border-nt-orange-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-nt-orange-600/20"
      />
      <InlineFieldFeedback
        fieldId={id}
        state={error ? "error" : "idle"}
        messageTemplate={error ?? ""}
      />
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  options,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-nt-slate-700">
        {label}
      </label>
      <select
        id={id}
        name={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border border-nt-slate-300/80 bg-white px-4 py-3 text-sm font-medium text-nt-slate-900 shadow-xs transition-all hover:border-nt-slate-400 focus:border-nt-orange-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-nt-orange-600/20"
      >
        <option value="">Select</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <InlineFieldFeedback
        fieldId={id}
        state={error ? "error" : "idle"}
        messageTemplate={error ?? ""}
      />
    </div>
  );
}
