"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/src/lib/utils/cn";
import { InlineFieldFeedback } from "@/src/components/apply/InlineFieldFeedback";
import { DocumentChecklist, useRequirements } from "@/app/apply/_components/DocumentChecklist";
import {
  ExistingLoansPanel,
  type ExistingLoansPanelHandle,
} from "@/app/apply/_components/ExistingLoansPanel";
import {
  ApplyFormValues,
  CollectionWriteResponse,
  ConsentStatusResponse,
  Constitution,
  SubmitApplicationResponse,
  WizardStepId,
} from "@/app/apply/lib/types";
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
import {
  ApplyApiError,
  addApplicationParty,
  createApplySession,
  fetchConsentStatus,
  fetchCurrentApplication,
  saveAadhaarIdentity,
  saveBusinessProfile,
  saveConsentGrants,
  saveEntityPan,
  saveGstRegistration,
  saveLoanIntent,
  savePanIdentity,
  savePrimaryPerson,
  submitCollectionApplication,
  updateApplicationParty,
} from "@/app/apply/lib/api";
import { Stepper, WizardStepDefinition } from "@/src/components/apply/Stepper";
import { NavigationFooter } from "@/src/components/apply/NavigationFooter";
import { ConsentOverlay } from "@/src/components/apply/ConsentOverlay";
import { clearDraftValues } from "@/app/apply/lib/storage";

const SATISFIED_REQUIREMENT_STATUSES = new Set([
  "collected",
  "accepted_for_review",
  "waived",
  "not_applicable",
]);

function useConsentStatus(enabled: boolean): {
  consentStatus: ConsentStatusResponse | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  setConsentStatus: (status: ConsentStatusResponse) => void;
} {
  const [consentStatus, setConsentStatus] = useState<ConsentStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchConsentStatus();
      setConsentStatus(data);
    } catch (fetchError) {
      setError(
        fetchError instanceof ApplyApiError
          ? fetchError.message
          : "Could not load consent details.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled && !consentStatus) {
      void reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, reload]);

  return { consentStatus, loading, error, reload, setConsentStatus };
}

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
  constitutionLabel?: string;
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
  linkBankLabel?: string;
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
  invalidConstitution?: string;
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
  constitutionLabel: "Business constitution",
  tenureLabel: "Tenure (months)",
  purposeLabel: "Purpose",
  referralCodeLabel: "Referral code (optional)",
  fullNameLabel: "Full name",
  mobileLabel: "Mobile number",
  emailLabel: "Email",
  pinCodeLabel: "Business PIN code",
  aadhaarLabel: "Aadhaar number",
  aadhaarConsentLabel:
    "I consent to the collection and storage of my Aadhaar details for this application",
  aadhaarConsentTitle: "Aadhaar consent",
  aadhaarConsentSummary: "Your Aadhaar number is collected as part of your application.",
  aadhaarConsentDetails:
    "Your Aadhaar number is encrypted when stored and masked when displayed.",
  panLabel: "PAN number",
  panConsentLabel:
    "I consent to the collection and storage of my PAN details for this application",
  panConsentTitle: "PAN consent",
  panConsentSummary: "Your PAN is collected as part of your application.",
  panConsentDetails: "Your PAN is encrypted when stored and masked when displayed.",
  gstRegisteredLabel: "Are you GST registered?",
  gstRegisteredYes: "Registered under GST",
  gstRegisteredNo: "Not registered",
  gstinLabel: "GSTIN",
  gstConsentLabel: "I consent to sharing my GST registration details",
  gstConsentTitle: "GST consent",
  gstConsentSummary: "Your GST registration number is collected as part of your application.",
  gstConsentDetails:
    "Your GST registration details are stored with your application and handled as described in the Consent Policy.",
  itrUploadLabel: "Documents",
  linkBankLabel: "Existing loans",
  privacyConsentLabel: "I agree to the Privacy Policy",
  termsConsentLabel: "I agree to the Terms of Use",
  creditConsentLabel: "I consent to a credit bureau check",
  communicationConsentLabel: "I consent to receive communication from NavDhan",
  reviewHeading: "Review your application",
  submissionSuccessHeading: "Application submitted",
  submissionSuccessBody: "Thank you! Your application has been submitted successfully.",
  referenceLabel: "Reference number",
  viewDashboardLabel: "Back to home",
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
  invalidConstitution: "Select a business constitution.",
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
  trustBadges: ["Consent-led application", "Encrypted data", "Independent lender decisions"],
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

function conflictMessage(latest: CollectionWriteResponse): string {
  return latest.status === "submitted"
    ? "This application has already been submitted."
    : "This application changed in another tab. We refreshed the latest data.";
}

function errorStatus(error: unknown): number | undefined {
  if (error instanceof ApplyApiError) return error.status;
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}

function nextCollectionStep(snapshot: CollectionWriteResponse): WizardStepId {
  const profile = snapshot.business_profile;
  const primary = snapshot.parties.find((party) => party.is_primary);
  const needsAdditionalRole =
    snapshot.values.constitution === "partnership"
      ? "co_applicant"
      : snapshot.values.constitution === "private_limited"
        ? "director"
        : null;
  const additional = needsAdditionalRole
    ? snapshot.parties.find((party) => party.role === needsAdditionalRole && !party.is_primary)
    : null;

  if (
    !profile.business_legal_name ||
    !profile.business_type_code ||
    !profile.income_type_code ||
    !profile.type_of_office ||
    !profile.location_tier ||
    !profile.business_pincode ||
    !profile.annual_turnover_range ||
    profile.gst_registered === null ||
    !primary?.full_name ||
    !primary.type_of_residence ||
    !primary.employment_status_code ||
    (needsAdditionalRole &&
      (!additional?.full_name ||
        !additional.type_of_residence ||
        !additional.employment_status_code))
  ) {
    return "personal_contact";
  }
  if (snapshot.parties.some((party) => !party.identifiers.aadhaar_masked)) {
    return "aadhaar_verification";
  }
  if (
    snapshot.parties.some((party) => !party.identifiers.pan_masked) ||
    (needsAdditionalRole && !snapshot.registrations.entity_pan_masked)
  ) {
    return "pan_verification";
  }
  if (profile.gst_registered && !snapshot.registrations.gstin_masked) {
    return "gst_verification";
  }
  return "itr_upload";
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

  const orderedSteps = useMemo<WizardStepId[]>(() => steps.map((step) => step.id), [steps]);
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
    constitution: initialValues.constitution,
    loan_amount: initialValues.loan_amount,
    tenure_months: initialValues.tenure_months,
    purpose: initialValues.purpose,
    referral_code: initialValues.referral_code,
    full_name: initialValues.full_name,
    mobile_number: initialValues.mobile_number,
    email: initialValues.email,
    business_pin_code: initialValues.business_pin_code,
    business_legal_name: initialValues.business_legal_name,
    trade_name: initialValues.trade_name,
    business_type_code: initialValues.business_type_code,
    income_type_code: initialValues.income_type_code,
    type_of_office: initialValues.type_of_office,
    location_tier: initialValues.location_tier,
    type_of_residence: initialValues.type_of_residence,
    employment_status_code: initialValues.employment_status_code,
    additional_party_full_name: initialValues.additional_party_full_name,
    additional_party_mobile_number: initialValues.additional_party_mobile_number,
    additional_party_email: initialValues.additional_party_email,
    additional_party_type_of_residence: initialValues.additional_party_type_of_residence,
    additional_party_employment_status_code: initialValues.additional_party_employment_status_code,
    additional_party_ownership_pct: initialValues.additional_party_ownership_pct,
    party_aadhaar_numbers: initialValues.party_aadhaar_numbers ?? {},
    confirm_party_aadhaar_numbers: initialValues.confirm_party_aadhaar_numbers ?? {},
    aadhaar_consent: initialValues.aadhaar_consent ?? false,
    party_pan_numbers: initialValues.party_pan_numbers ?? {},
    confirm_party_pan_numbers: initialValues.confirm_party_pan_numbers ?? {},
    entity_pan: initialValues.entity_pan,
    confirm_entity_pan: initialValues.confirm_entity_pan,
    pan_consent: initialValues.pan_consent ?? false,
    gst_registered: initialValues.gst_registered,
    gstin: initialValues.gstin,
    confirm_gstin: initialValues.confirm_gstin,
    gst_consent: initialValues.gst_consent ?? false,
    annual_turnover: initialValues.annual_turnover,
  }));

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [application, setApplication] = useState<CollectionWriteResponse | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    requirements,
    loading: requirementsLoading,
    error: requirementsError,
    reload: reloadRequirements,
    setRequirements,
  } = useRequirements(application !== null);

  const {
    consentStatus,
    loading: consentLoading,
    error: consentError,
    reload: reloadConsent,
    setConsentStatus,
  } = useConsentStatus(application !== null);

  const [consentGrants, setConsentGrants] = useState<Record<string, boolean>>({});
  const [submissionResultState, setSubmissionResultState] =
    useState<SubmitApplicationResponse | null>(null);
  const existingLoansPanelRef = useRef<ExistingLoansPanelHandle>(null);

  useEffect(() => {
    if (!consentStatus) return;
    setConsentGrants((previous) => {
      const next = { ...previous };
      let changed = false;
      for (const purpose of consentStatus.purposes) {
        if (!(purpose.purpose_code in next)) {
          next[purpose.purpose_code] = purpose.granted;
          changed = true;
        }
      }
      return changed ? next : previous;
    });
  }, [consentStatus]);

  // `application`, `requirements`, and `consentStatus` are three separately
  // fetched/mutated snapshots of the SAME backend `loan_applications` row —
  // every one of their write endpoints advances the one shared
  // `lock_version` column and returns it, but only into its own slice of
  // state. A document upload, credit-declaration save, or consent grant on
  // one slice otherwise leaves the other two holding a stale
  // `expected_lock_version`, so the very next write from *this same tab*
  // gets rejected as if a second tab had raced it. Reconcile all three to
  // whichever value is highest immediately after every render, so any
  // handler reading any slice's `lock_version` always sees the real
  // current one. This does not affect genuine multi-tab conflicts: a write
  // from another tab changes the backend row without ever touching this
  // tab's React state, so this tab's next write still carries a version
  // behind what the backend now holds and is still correctly rejected.
  useEffect(() => {
    const versions = [
      application?.lock_version,
      requirements?.lock_version,
      consentStatus?.lock_version,
    ].filter((value): value is number => typeof value === "number");
    if (versions.length < 2) return;
    const latest = Math.max(...versions);

    if (application && application.lock_version < latest) {
      setApplication({ ...application, lock_version: latest });
    }
    if (requirements && requirements.lock_version < latest) {
      setRequirements({ ...requirements, lock_version: latest });
    }
    if (consentStatus && consentStatus.lock_version < latest) {
      setConsentStatus({ ...consentStatus, lock_version: latest });
    }
  }, [application, requirements, consentStatus, setRequirements, setConsentStatus]);

  const currentStepId = orderedSteps[currentIndex] ?? "loan_intent";

  // Requirements are fetched once, the first time `application` becomes
  // non-null (see useRequirements above) — normally right after the loan-
  // intent step. Adding a co-applicant/director party (partnership/private
  // limited, step 2) materializes new person-scoped requirements on the
  // backend afterward, which that stale snapshot never picks up: the
  // Documents step would silently omit the co-applicant/director's PAN Card
  // and Aadhaar KYC upload rows until an unrelated full page reload
  // happened to refetch everything. Refetch on every entry into the
  // Documents step so it always reflects the current party set. Guarded on
  // `requirements` already being non-null so this never races the initial
  // fetch useRequirements kicks off on the same render application first
  // becomes non-null (both effects can fire in that one commit) — without
  // the guard, two concurrent fetches on mount desync any caller (tests
  // included) that queues exactly one mocked response per expected call.
  useEffect(() => {
    if (currentStepId === "itr_upload" && requirements !== null) {
      void reloadRequirements();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepId]);

  const applySnapshot = useCallback(
    (snapshot: CollectionWriteResponse, resume: boolean) => {
      const primary = snapshot.parties.find((party) => party.is_primary);
      const expectedAdditionalRole =
        snapshot.values.constitution === "partnership"
          ? "co_applicant"
          : snapshot.values.constitution === "private_limited"
            ? "director"
            : null;
      const additional = expectedAdditionalRole
        ? snapshot.parties.find(
            (party) => party.role === expectedAdditionalRole && !party.is_primary,
          )
        : undefined;
      setApplication(snapshot);
      setValues((previous) => ({
        ...previous,
        constitution: snapshot.values.constitution,
        loan_amount: snapshot.values.requested_amount,
        tenure_months: snapshot.values.requested_tenure_months,
        purpose: snapshot.values.purpose,
        referral_code: snapshot.values.referral_code ?? undefined,
        business_legal_name: snapshot.business_profile.business_legal_name ?? undefined,
        trade_name: snapshot.business_profile.trade_name ?? undefined,
        business_type_code: snapshot.business_profile.business_type_code ?? undefined,
        income_type_code: snapshot.business_profile.income_type_code ?? undefined,
        type_of_office: snapshot.business_profile.type_of_office ?? undefined,
        location_tier: snapshot.business_profile.location_tier ?? undefined,
        business_pin_code: snapshot.business_profile.business_pincode ?? undefined,
        annual_turnover: snapshot.business_profile.annual_turnover_range ?? undefined,
        gst_registered: snapshot.business_profile.gst_registered ?? undefined,
        full_name: primary?.full_name ?? undefined,
        type_of_residence: primary?.type_of_residence ?? undefined,
        employment_status_code: primary?.employment_status_code ?? undefined,
        additional_party_full_name: additional?.full_name ?? undefined,
        additional_party_type_of_residence: additional?.type_of_residence ?? undefined,
        additional_party_employment_status_code: additional?.employment_status_code ?? undefined,
        additional_party_ownership_pct: additional?.ownership_pct ?? undefined,
      }));
      if (resume) {
        // A submitted application is immutable — resume/refresh must land
        // straight on the result step, never back into an editable step
        // computed from field completeness (see HANDOFF §2 bug 2 and the
        // Phase 6 gate: "do not route a submitted borrower back into
        // document/KYC steps").
        const targetStepId: WizardStepId =
          snapshot.status === "submitted" ? "submission_result" : nextCollectionStep(snapshot);
        const resumeIndex = orderedSteps.indexOf(targetStepId);
        if (resumeIndex >= 0) {
          setCurrentIndex(resumeIndex);
          setCompletedSteps(orderedSteps.slice(0, resumeIndex));
        }
      }
    },
    [orderedSteps],
  );

  useEffect(() => {
    let active = true;
    clearDraftValues(locale);
    async function initializeBrowserSession() {
      try {
        const snapshot = await fetchCurrentApplication();
        if (active) applySnapshot(snapshot, true);
      } catch (error) {
        const status = errorStatus(error);
        if (status === 401) {
          try {
            await createApplySession();
          } catch {
            if (active) setApiError("We could not start your secure application session.");
          }
        } else if (status !== 404 && active) {
          setApiError("We could not restore your application. Please try again.");
        }
      } finally {
        if (active) setIsBootstrapping(false);
      }
    }
    void initializeBrowserSession();
    return () => {
      active = false;
    };
  }, [applySnapshot, locale]);

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

  const updatePartyIdentifier = (
    field:
      | "party_aadhaar_numbers"
      | "party_pan_numbers"
      | "confirm_party_aadhaar_numbers"
      | "confirm_party_pan_numbers",
    partyId: string,
    value: string,
  ) => {
    setValues((previous) => ({
      ...previous,
      [field]: { ...((previous[field] as Record<string, string>) ?? {}), [partyId]: value },
    }));
    const errorField = `${field}_${partyId}`;
    setTouched((previous) => ({ ...previous, [errorField]: true }));
    if (errors[errorField]) {
      setErrors((previous) => {
        const next = { ...previous };
        delete next[errorField];
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
        if (!values.constitution) {
          next.constitution = t.invalidConstitution ?? "Select a business constitution";
        }
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
        if (
          !values.business_legal_name ||
          values.business_legal_name.trim().length < 2 ||
          values.business_legal_name.trim().length > 150
        ) {
          next.business_legal_name = "Enter the registered business name";
        }
        if (!values.business_type_code) next.business_type_code = "Select a business type";
        if (!values.income_type_code) next.income_type_code = "Select an income type";
        if (!values.type_of_office) next.type_of_office = "Select an office type";
        if (!values.location_tier) next.location_tier = "Select a location tier";
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
        if (!validateAnnualTurnover(values.annual_turnover)) {
          next.annual_turnover = "Select annual turnover";
        }
        if (typeof values.gst_registered !== "boolean") {
          next.gst_registered = "Select your GST registration status";
        }
        if (!values.type_of_residence) next.type_of_residence = "Select a residence type";
        if (!values.employment_status_code) {
          next.employment_status_code = "Select employment status";
        }
        if (values.constitution && values.constitution !== "proprietorship") {
          if (!validateFullName(values.additional_party_full_name)) {
            next.additional_party_full_name = "Enter a valid name";
          }
          if (!validateMobileNumber(values.additional_party_mobile_number)) {
            next.additional_party_mobile_number = t.invalidMobile ?? "Invalid mobile";
          }
          if (!validateEmail(values.additional_party_email)) {
            next.additional_party_email = t.invalidEmail ?? "Invalid email";
          }
          if (!values.additional_party_type_of_residence) {
            next.additional_party_type_of_residence = "Select a residence type";
          }
          if (!values.additional_party_employment_status_code) {
            next.additional_party_employment_status_code = "Select employment status";
          }
          if (
            values.additional_party_ownership_pct !== undefined &&
            (values.additional_party_ownership_pct < 0 ||
              values.additional_party_ownership_pct > 100)
          ) {
            next.additional_party_ownership_pct = "Ownership must be between 0 and 100";
          }
        }
        break;
      }
      case "aadhaar_verification": {
        for (const party of application?.parties ?? []) {
          const field = `party_aadhaar_numbers_${party.party_id}`;
          const confirmField = `confirm_party_aadhaar_numbers_${party.party_id}`;
          const suppliedValue = values.party_aadhaar_numbers?.[party.party_id];
          const confirmValue = values.confirm_party_aadhaar_numbers?.[party.party_id];

          if (!party.identifiers.aadhaar_masked && !validateAadhaarNumber(suppliedValue)) {
            next[field] = t.invalidAadhaar ?? "Invalid aadhaar";
          }
          if (!party.identifiers.aadhaar_masked) {
            if (typeof confirmValue !== "string" || confirmValue.trim() === "") {
              next[confirmField] = "Confirm the Aadhaar number";
            } else if (confirmValue !== suppliedValue) {
              next[confirmField] = "Aadhaar numbers do not match";
            }
          }
        }
        if (!values.aadhaar_consent) {
          next.aadhaar_consent = "Please accept the Aadhaar consent";
        }
        break;
      }
      case "pan_verification": {
        const enteredEntityPan = values.entity_pan?.trim().toUpperCase();
        const confirmEntityPan = values.confirm_entity_pan?.trim().toUpperCase();
        for (const party of application?.parties ?? []) {
          const field = `party_pan_numbers_${party.party_id}`;
          const confirmField = `confirm_party_pan_numbers_${party.party_id}`;
          const suppliedValue = values.party_pan_numbers?.[party.party_id];
          const confirmValue = values.confirm_party_pan_numbers?.[party.party_id];

          if (!party.identifiers.pan_masked && !validatePanNumber(suppliedValue)) {
            next[field] = t.invalidPan ?? "Invalid pan";
          }
          if (!party.identifiers.pan_masked) {
            if (typeof confirmValue !== "string" || confirmValue.trim() === "") {
              next[confirmField] = "Confirm the PAN number";
            } else if (confirmValue.toUpperCase() !== (suppliedValue ?? "").toUpperCase()) {
              next[confirmField] = "PAN numbers do not match";
            }
          }
          if (
            enteredEntityPan &&
            typeof suppliedValue === "string" &&
            suppliedValue.trim().toUpperCase() === enteredEntityPan
          ) {
            const message = "Business PAN must be different from every personal PAN";
            next[field] = message;
            next.entity_pan = message;
          }
        }
        if (!values.pan_consent) {
          next.pan_consent = "Please accept the PAN consent";
        }
        if (
          values.constitution !== "proprietorship" &&
          !application?.registrations.entity_pan_masked &&
          !validatePanNumber(values.entity_pan)
        ) {
          next.entity_pan = t.invalidPan ?? "Invalid entity PAN";
        }
        if (
          values.constitution !== "proprietorship" &&
          !application?.registrations.entity_pan_masked
        ) {
          if (!confirmEntityPan) {
            next.confirm_entity_pan = "Confirm the Business PAN";
          } else if (confirmEntityPan !== enteredEntityPan) {
            next.confirm_entity_pan = "Business PANs do not match";
          }
        }
        break;
      }
      case "gst_verification": {
        if (typeof values.gst_registered !== "boolean") {
          next.gst_registered = "Select your GST registration status";
        }
        if (values.gst_registered === true) {
          if (!application?.registrations.gstin_masked) {
            if (!values.gstin || !validateGstin(values.gstin)) {
              next.gstin = t.invalidGstin ?? "Invalid gstin";
            }
            const confirmGstin = values.confirm_gstin?.trim().toUpperCase();
            if (!confirmGstin) {
              next.confirm_gstin = "Confirm the GSTIN";
            } else if (confirmGstin !== values.gstin?.trim().toUpperCase()) {
              next.confirm_gstin = "GSTINs do not match";
            }
          }
          if (!values.gst_consent) {
            next.gst_consent = "Please accept the GST consent";
          }
        }
        break;
      }
      case "itr_upload":
      case "bank_statements": {
        break;
      }
      case "review_submit": {
        // Consent completeness is gated by canContinue (backed by
        // consentStatus/consentGrants) and re-checked authoritatively by
        // the backend on submit; there is no client-only field to validate
        // here.
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
        return (
          !!values.constitution &&
          !!values.loan_amount &&
          !!values.tenure_months &&
          !!values.purpose
        );
      }
      case "personal_contact": {
        return true;
      }
      case "aadhaar_verification": {
        return (
          !!values.aadhaar_consent &&
          (application?.parties ?? []).every(
            (party) =>
              !!party.identifiers.aadhaar_masked ||
              !!values.party_aadhaar_numbers?.[party.party_id],
          )
        );
      }
      case "pan_verification": {
        return true;
      }
      case "gst_verification": {
        return true;
      }
      case "itr_upload": {
        return true;
      }
      case "bank_statements": {
        return true;
      }
      case "review_submit": {
        const mandatoryConsentGranted = (consentStatus?.purposes ?? [])
          .filter((purpose) => purpose.is_mandatory)
          .every((purpose) => consentGrants[purpose.purpose_code] ?? purpose.granted);
        const documentsSatisfied = (requirements?.requirements ?? []).every(
          (row) => !row.blocks_submission || SATISFIED_REQUIREMENT_STATUSES.has(row.status),
        );
        return !!consentStatus && !!requirements && mandatoryConsentGranted && documentsSatisfied;
      }
      default:
        return true;
    }
  }, [values, currentStepId, consentStatus, consentGrants, requirements, application?.parties]);

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

  const businessProfilePayload = (expectedLockVersion: number) => ({
    business_legal_name: values.business_legal_name!.trim(),
    ...(values.trade_name?.trim() ? { trade_name: values.trade_name.trim() } : {}),
    business_type_code: values.business_type_code!,
    income_type_code: values.income_type_code!,
    type_of_office: values.type_of_office!,
    location_tier: values.location_tier!,
    business_pincode: values.business_pin_code!,
    annual_turnover_range: values.annual_turnover as NonNullable<
      CollectionWriteResponse["business_profile"]["annual_turnover_range"]
    >,
    gst_registered: values.gst_registered!,
    expected_lock_version: expectedLockVersion,
  });

  const persistCollectionStep = async (): Promise<CollectionWriteResponse | null> => {
    const lockVersion = application?.lock_version ?? 0;
    switch (currentStepId) {
      case "loan_intent":
        return saveLoanIntent({
          constitution: values.constitution!,
          requested_amount: values.loan_amount!,
          requested_tenure_months: values.tenure_months!,
          purpose: values.purpose as CollectionWriteResponse["values"]["purpose"],
          ...(values.referral_code ? { referral_code: values.referral_code } : {}),
          expected_lock_version: lockVersion,
        });
      case "personal_contact": {
        let snapshot = await saveBusinessProfile(businessProfilePayload(lockVersion));
        snapshot = await savePrimaryPerson({
          full_name: values.full_name!.trim(),
          mobile_number: values.mobile_number!,
          email: values.email!.trim().toLowerCase(),
          type_of_residence: values.type_of_residence!,
          employment_status_code: values.employment_status_code!,
          expected_lock_version: snapshot.lock_version,
        });
        if (values.constitution !== "proprietorship") {
          const role = values.constitution === "partnership" ? "co_applicant" : "director";
          // For private_limited, the primary applicant is also stored with
          // role="director" (see collection_application.py's primary_role
          // logic) — the same role string as this second, additional
          // director. Excluding is_primary here is required, not
          // defensive: without it this incorrectly matches the primary
          // party and PUTs over their record, which the backend rejects
          // with 422 ("Use the primary-person endpoint").
          const existingParty = snapshot.parties.find(
            (party) => party.role === role && !party.is_primary,
          );
          const partyPayload = {
            full_name: values.additional_party_full_name!.trim(),
            mobile_number: values.additional_party_mobile_number!,
            email: values.additional_party_email!.trim().toLowerCase(),
            type_of_residence: values.additional_party_type_of_residence!,
            employment_status_code: values.additional_party_employment_status_code!,
            ...(values.additional_party_ownership_pct !== undefined
              ? { ownership_pct: values.additional_party_ownership_pct }
              : {}),
            expected_lock_version: snapshot.lock_version,
          };
          snapshot = existingParty
            ? await updateApplicationParty(existingParty.party_id, partyPayload)
            : await addApplicationParty({ ...partyPayload, role });
        }
        return snapshot;
      }
      case "aadhaar_verification": {
        if (!application) throw new Error("Application is missing");
        let snapshot = application;
        for (const party of application.parties) {
          const aadhaarNumber = values.party_aadhaar_numbers?.[party.party_id];
          if (!aadhaarNumber) continue;
          snapshot = await saveAadhaarIdentity(party.party_id, {
            aadhaar_number: aadhaarNumber,
            expected_lock_version: snapshot.lock_version,
          });
        }
        return snapshot;
      }
      case "pan_verification": {
        if (!application) throw new Error("Application is missing");
        let snapshot = application;
        for (const party of application.parties) {
          const panNumber = values.party_pan_numbers?.[party.party_id];
          if (!panNumber) continue;
          snapshot = await savePanIdentity(party.party_id, {
            pan_number: panNumber,
            expected_lock_version: snapshot.lock_version,
          });
        }
        if (values.constitution !== "proprietorship" && values.entity_pan) {
          snapshot = await saveEntityPan({
            entity_pan: values.entity_pan!,
            expected_lock_version: snapshot.lock_version,
          });
        }
        return snapshot;
      }
      case "gst_verification": {
        let snapshot = await saveBusinessProfile(businessProfilePayload(lockVersion));
        snapshot = await saveGstRegistration({
          gst_registered: values.gst_registered!,
          gst_consent: values.gst_registered ? true : false,
          ...(values.gst_registered
            ? { gstin: values.gstin!, state_code: values.gstin!.slice(0, 2) }
            : {}),
          expected_lock_version: snapshot.lock_version,
        });
        return snapshot;
      }
      default:
        return null;
    }
  };

  const handleContinue = async () => {
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

    if (
      currentStepId === "loan_intent" ||
      currentStepId === "personal_contact" ||
      currentStepId === "aadhaar_verification" ||
      currentStepId === "pan_verification" ||
      currentStepId === "gst_verification"
    ) {
      setIsSaving(true);
      setApiError(null);
      try {
        const snapshot = await persistCollectionStep();
        if (snapshot) {
          applySnapshot(snapshot, false);
          setValues((previous) => ({
            ...previous,
            ...(currentStepId === "personal_contact"
              ? {
                  mobile_number: undefined,
                  email: undefined,
                  additional_party_mobile_number: undefined,
                  additional_party_email: undefined,
                }
              : {}),
            ...(currentStepId === "aadhaar_verification"
              ? {
                  party_aadhaar_numbers: {},
                  confirm_party_aadhaar_numbers: {},
                }
              : {}),
            ...(currentStepId === "pan_verification"
              ? {
                  party_pan_numbers: {},
                  confirm_party_pan_numbers: {},
                  entity_pan: undefined,
                  confirm_entity_pan: undefined,
                }
              : {}),
            ...(currentStepId === "gst_verification"
              ? { gstin: undefined, confirm_gstin: undefined }
              : {}),
          }));
        }
      } catch (error) {
        if (errorStatus(error) === 409) {
          try {
            const latest = await fetchCurrentApplication();
            applySnapshot(latest, true);
            setApiError(conflictMessage(latest));
          } catch {
            setApiError("This application changed. Refresh and try again.");
          }
        } else {
          setApiError("We could not save this step. Please try again.");
        }
        setIsSaving(false);
        return;
      }
      setIsSaving(false);
    }

    if (currentStepId === "bank_statements") {
      setIsSaving(true);
      const persisted =
        (await existingLoansPanelRef.current?.persistDeclarationForContinue()) ?? false;
      setIsSaving(false);
      if (!persisted) return;
    }

    if (currentStepId === "review_submit") {
      if (!application || !consentStatus) return;
      setIsSaving(true);
      setApiError(null);
      try {
        const consentResult = await saveConsentGrants({
          grants: Object.fromEntries(
            consentStatus.purposes.map((purpose) => [
              purpose.purpose_code,
              consentGrants[purpose.purpose_code] ?? purpose.granted,
            ]),
          ),
          expected_lock_version: application.lock_version,
        });
        setConsentStatus(consentResult);
        const result = await submitCollectionApplication({
          expected_lock_version: consentResult.lock_version,
        });
        setSubmissionResultState(result);
        setApplication((previous) =>
          previous
            ? { ...previous, lock_version: result.lock_version, status: result.status }
            : previous,
        );
        advance();
      } catch (error) {
        if (errorStatus(error) === 422) {
          setApiError("Your application is not complete yet. Please review the checklist above.");
        } else if (errorStatus(error) === 409) {
          try {
            const latest = await fetchCurrentApplication();
            applySnapshot(latest, true);
            setApiError(conflictMessage(latest));
          } catch {
            setApiError("This application changed. Refresh and try again.");
          }
        } else {
          setApiError("We could not submit your application. Please try again.");
        }
      } finally {
        setIsSaving(false);
      }
      return;
    }

    advance();
  };

  const currentStepDef = steps.find((s) => s.id === currentStepId);

  const renderLoanIntent = () => (
    <div className="space-y-5">
      <SelectField
        id="constitution"
        label={t.constitutionLabel ?? "Business constitution"}
        value={values.constitution ?? ""}
        options={[
          { value: "proprietorship", label: "Proprietorship" },
          { value: "partnership", label: "Partnership" },
          { value: "private_limited", label: "Private limited company" },
        ]}
        onChange={(value) => updateValue("constitution", value as Constitution)}
        error={touched.constitution ? errors.constitution : undefined}
      />
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
      <h2 className="text-base font-semibold text-nt-slate-900">Business profile</h2>
      <TextField
        id="business_legal_name"
        label="Registered business name"
        value={values.business_legal_name ?? ""}
        onChange={(value) => updateValue("business_legal_name", value)}
        error={touched.business_legal_name ? errors.business_legal_name : undefined}
      />
      <TextField
        id="trade_name"
        label="Trade name (optional)"
        value={values.trade_name ?? ""}
        onChange={(value) => updateValue("trade_name", value)}
      />
      <SelectField
        id="business_type_code"
        label="Business type"
        value={values.business_type_code ?? ""}
        options={[
          { value: "trading", label: "Trading" },
          { value: "manufacturing", label: "Manufacturing" },
          { value: "services", label: "Services" },
        ]}
        onChange={(value) =>
          updateValue("business_type_code", value as ApplyFormValues["business_type_code"])
        }
        error={touched.business_type_code ? errors.business_type_code : undefined}
      />
      <SelectField
        id="income_type_code"
        label="Primary income type"
        value={values.income_type_code ?? ""}
        options={[
          { value: "business_income", label: "Business income" },
          { value: "salary", label: "Salary" },
          { value: "other", label: "Other" },
        ]}
        onChange={(value) =>
          updateValue("income_type_code", value as ApplyFormValues["income_type_code"])
        }
        error={touched.income_type_code ? errors.income_type_code : undefined}
      />
      <SelectField
        id="type_of_office"
        label="Office type"
        value={values.type_of_office ?? ""}
        options={[
          { value: "factory_premises", label: "Factory premises" },
          { value: "home_office", label: "Home office" },
          { value: "owned_office", label: "Owned office" },
          { value: "rented_office", label: "Rented office" },
          { value: "other", label: "Other" },
        ]}
        onChange={(value) =>
          updateValue("type_of_office", value as ApplyFormValues["type_of_office"])
        }
        error={touched.type_of_office ? errors.type_of_office : undefined}
      />
      <SelectField
        id="location_tier"
        label="Business location tier"
        value={values.location_tier ?? ""}
        options={[
          { value: "tier1", label: "Tier 1" },
          { value: "tier2", label: "Tier 2" },
          { value: "tier3", label: "Tier 3" },
        ]}
        onChange={(value) =>
          updateValue("location_tier", value as ApplyFormValues["location_tier"])
        }
        error={touched.location_tier ? errors.location_tier : undefined}
      />
      <h2 className="pt-2 text-base font-semibold text-nt-slate-900">Primary applicant</h2>
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
      <SavedValue value={application?.parties.find((party) => party.is_primary)?.mobile_masked} />
      <TextField
        id="email"
        label={t.emailLabel ?? "Email"}
        type="email"
        value={values.email ?? ""}
        onChange={(value) => updateValue("email", value)}
        error={touched.email ? errors.email : undefined}
      />
      <SavedValue value={application?.parties.find((party) => party.is_primary)?.email_masked} />
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
        error={touched.annual_turnover ? errors.annual_turnover : undefined}
      />
      <InlineFieldFeedback
        fieldId="annual_turnover"
        state="info"
        messageTemplate="Select the turnover range that best reflects your last financial year."
      />
      <SelectField
        id="type_of_residence"
        label="Residence type"
        value={values.type_of_residence ?? ""}
        options={[
          { value: "family_owned", label: "Family owned" },
          { value: "owned", label: "Owned" },
          { value: "rented", label: "Rented" },
          { value: "other", label: "Other" },
        ]}
        onChange={(value) =>
          updateValue("type_of_residence", value as ApplyFormValues["type_of_residence"])
        }
        error={touched.type_of_residence ? errors.type_of_residence : undefined}
      />
      <SelectField
        id="employment_status_code"
        label="Employment status"
        value={values.employment_status_code ?? ""}
        options={[
          { value: "self_employed", label: "Self employed" },
          { value: "salaried", label: "Salaried" },
          { value: "other", label: "Other" },
        ]}
        onChange={(value) =>
          updateValue("employment_status_code", value as ApplyFormValues["employment_status_code"])
        }
        error={touched.employment_status_code ? errors.employment_status_code : undefined}
      />
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-nt-slate-700">
          {t.gstRegisteredLabel ?? "Are you GST registered?"}
          <span className="ml-1 font-bold text-nt-red-500">*</span>
        </legend>
        <label className="flex items-center gap-2 text-sm text-nt-slate-700">
          <input
            type="radio"
            name="profile_gst_registered"
            checked={values.gst_registered === true}
            onChange={() => updateValue("gst_registered", true)}
          />
          {t.gstRegisteredYes ?? "Registered under GST"}
        </label>
        <label className="flex items-center gap-2 text-sm text-nt-slate-700">
          <input
            type="radio"
            name="profile_gst_registered"
            checked={values.gst_registered === false}
            onChange={() => updateValue("gst_registered", false)}
          />
          {t.gstRegisteredNo ?? "Not registered"}
        </label>
        <InlineFieldFeedback
          fieldId="gst_registered"
          state={touched.gst_registered && errors.gst_registered ? "error" : "idle"}
          messageTemplate={errors.gst_registered ?? ""}
        />
      </fieldset>
      {values.constitution !== undefined && values.constitution !== "proprietorship" && (
        <div className="space-y-5 rounded-xl border border-nt-slate-200 p-4">
          <h2 className="text-base font-semibold text-nt-slate-900">
            {values.constitution === "partnership" ? "Co-applicant" : "Director"}
          </h2>
          <TextField
            id="additional_party_full_name"
            label="Full name"
            value={values.additional_party_full_name ?? ""}
            onChange={(value) => updateValue("additional_party_full_name", value)}
            error={
              touched.additional_party_full_name ? errors.additional_party_full_name : undefined
            }
          />
          <TextField
            id="additional_party_mobile_number"
            label="Mobile number"
            value={values.additional_party_mobile_number ?? ""}
            onChange={(value) => updateValue("additional_party_mobile_number", value)}
            error={
              touched.additional_party_mobile_number
                ? errors.additional_party_mobile_number
                : undefined
            }
            inputMode="tel"
          />
          <TextField
            id="additional_party_email"
            label="Email"
            type="email"
            value={values.additional_party_email ?? ""}
            onChange={(value) => updateValue("additional_party_email", value)}
            error={touched.additional_party_email ? errors.additional_party_email : undefined}
          />
          <SelectField
            id="additional_party_type_of_residence"
            label="Residence type"
            value={values.additional_party_type_of_residence ?? ""}
            options={[
              { value: "family_owned", label: "Family owned" },
              { value: "owned", label: "Owned" },
              { value: "rented", label: "Rented" },
              { value: "other", label: "Other" },
            ]}
            onChange={(value) =>
              updateValue(
                "additional_party_type_of_residence",
                value as ApplyFormValues["additional_party_type_of_residence"],
              )
            }
            error={
              touched.additional_party_type_of_residence
                ? errors.additional_party_type_of_residence
                : undefined
            }
          />
          <SelectField
            id="additional_party_employment_status_code"
            label="Employment status"
            value={values.additional_party_employment_status_code ?? ""}
            options={[
              { value: "self_employed", label: "Self employed" },
              { value: "salaried", label: "Salaried" },
              { value: "other", label: "Other" },
            ]}
            onChange={(value) =>
              updateValue(
                "additional_party_employment_status_code",
                value as ApplyFormValues["additional_party_employment_status_code"],
              )
            }
            error={
              touched.additional_party_employment_status_code
                ? errors.additional_party_employment_status_code
                : undefined
            }
          />
          <TextField
            id="additional_party_ownership_pct"
            label="Ownership percentage (optional)"
            value={values.additional_party_ownership_pct ?? ""}
            onChange={(value) =>
              updateValue(
                "additional_party_ownership_pct",
                value === "" ? undefined : Number(value),
              )
            }
            error={
              touched.additional_party_ownership_pct
                ? errors.additional_party_ownership_pct
                : undefined
            }
            inputMode="numeric"
          />
        </div>
      )}
    </div>
  );

  const renderAadhaar = () => (
    <div className="space-y-5">
      {(application?.parties ?? []).map((party) => {
        const field = `party_aadhaar_numbers_${party.party_id}`;
        const confirmField = `confirm_party_aadhaar_numbers_${party.party_id}`;
        const partyName = party.full_name ?? (party.is_primary ? "Primary applicant" : "Applicant");
        return (
          <div key={party.party_id} className="space-y-3">
            <TextField
              id={`aadhaar_number_${party.party_id}`}
              label={`${t.aadhaarLabel ?? "Aadhaar number"} for ${partyName}`}
              value={values.party_aadhaar_numbers?.[party.party_id] ?? ""}
              onChange={(value) =>
                updatePartyIdentifier("party_aadhaar_numbers", party.party_id, value)
              }
              error={touched[field] ? errors[field] : undefined}
              inputMode="numeric"
            />
            {!party.identifiers.aadhaar_masked && (
              <TextField
                id={`confirm_aadhaar_number_${party.party_id}`}
                label={`Confirm Aadhaar number for ${partyName}`}
                value={values.confirm_party_aadhaar_numbers?.[party.party_id] ?? ""}
                onChange={(value) =>
                  updatePartyIdentifier("confirm_party_aadhaar_numbers", party.party_id, value)
                }
                error={touched[confirmField] ? errors[confirmField] : undefined}
                inputMode="numeric"
              />
            )}
            <SavedValue value={party.identifiers.aadhaar_masked} />
          </div>
        );
      })}
      <ConsentOverlay
        title={t.aadhaarConsentTitle ?? "Aadhaar consent"}
        summary={
          t.aadhaarConsentSummary ?? "Your Aadhaar number is collected to verify your identity."
        }
        details={
          t.aadhaarConsentDetails ??
          "Your Aadhaar number is used only for KYC and is masked after verification."
        }
        accepted={values.aadhaar_consent ?? false}
        onChange={(accepted) => updateValue("aadhaar_consent", accepted)}
        checkboxLabel={
          t.aadhaarConsentLabel ??
          "I consent to sharing my Aadhaar details for identity verification"
        }
        ariaLabel="Aadhaar consent"
      />
      <InlineFieldFeedback
        fieldId="aadhaar_consent"
        state={touched.aadhaar_consent && errors.aadhaar_consent ? "error" : "idle"}
        messageTemplate={touched.aadhaar_consent ? (errors.aadhaar_consent ?? "") : ""}
      />
    </div>
  );

  const renderPan = () => (
    <div className="space-y-5">
      {(application?.parties ?? []).map((party) => {
        const field = `party_pan_numbers_${party.party_id}`;
        const confirmField = `confirm_party_pan_numbers_${party.party_id}`;
        const partyName = party.full_name ?? (party.is_primary ? "Primary applicant" : "Applicant");
        return (
          <div key={party.party_id} className="space-y-3">
            <TextField
              id={`pan_number_${party.party_id}`}
              label={`${t.panLabel ?? "PAN number"} for ${partyName}`}
              value={values.party_pan_numbers?.[party.party_id] ?? ""}
              onChange={(value) =>
                updatePartyIdentifier("party_pan_numbers", party.party_id, value.toUpperCase())
              }
              error={touched[field] ? errors[field] : undefined}
            />
            {!party.identifiers.pan_masked && (
              <TextField
                id={`confirm_pan_number_${party.party_id}`}
                label={`Confirm PAN number for ${partyName}`}
                value={values.confirm_party_pan_numbers?.[party.party_id] ?? ""}
                onChange={(value) =>
                  updatePartyIdentifier(
                    "confirm_party_pan_numbers",
                    party.party_id,
                    value.toUpperCase(),
                  )
                }
                error={touched[confirmField] ? errors[confirmField] : undefined}
              />
            )}
            <SavedValue value={party.identifiers.pan_masked} />
          </div>
        );
      })}
      {values.constitution !== undefined && values.constitution !== "proprietorship" && (
        <div className="space-y-3">
          <TextField
            id="entity_pan"
            label="Business PAN"
            value={values.entity_pan ?? ""}
            onChange={(value) => updateValue("entity_pan", value.toUpperCase())}
            error={touched.entity_pan ? errors.entity_pan : undefined}
          />
          {!application?.registrations.entity_pan_masked && (
            <TextField
              id="confirm_entity_pan"
              label="Confirm Business PAN"
              value={values.confirm_entity_pan ?? ""}
              onChange={(value) => updateValue("confirm_entity_pan", value.toUpperCase())}
              error={touched.confirm_entity_pan ? errors.confirm_entity_pan : undefined}
            />
          )}
          <SavedValue value={application?.registrations.entity_pan_masked} />
        </div>
      )}
      <ConsentOverlay
        title={t.panConsentTitle ?? "PAN consent"}
        summary={
          t.panConsentSummary ?? "Your PAN is collected to confirm identity and tax compliance."
        }
        details={
          t.panConsentDetails ?? "This is a one-time verification and your PAN is stored securely."
        }
        accepted={values.pan_consent ?? false}
        onChange={(accepted) => updateValue("pan_consent", accepted)}
        checkboxLabel={t.panConsentLabel ?? "I consent to PAN verification"}
        ariaLabel="PAN consent"
      />
      <InlineFieldFeedback
        fieldId="pan_consent"
        state={touched.pan_consent && errors.pan_consent ? "error" : "idle"}
        messageTemplate={touched.pan_consent ? (errors.pan_consent ?? "") : ""}
      />
    </div>
  );

  const renderGst = () => (
    <div className="space-y-5">
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-nt-slate-700">
          {t.gstRegisteredLabel ?? "Are you GST registered?"}
          <span className="ml-1 font-bold text-nt-red-500">*</span>
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
        <div className="space-y-3">
          <TextField
            id="gstin"
            label={t.gstinLabel ?? "GSTIN"}
            value={values.gstin ?? ""}
            onChange={(value) => updateValue("gstin", value.toUpperCase())}
            error={touched.gstin ? errors.gstin : undefined}
          />
          {!application?.registrations.gstin_masked && (
            <TextField
              id="confirm_gstin"
              label="Confirm GSTIN"
              value={values.confirm_gstin ?? ""}
              onChange={(value) => updateValue("confirm_gstin", value.toUpperCase())}
              error={touched.confirm_gstin ? errors.confirm_gstin : undefined}
            />
          )}
          <SavedValue value={application?.registrations.gstin_masked} />
          <ConsentOverlay
            title={t.gstConsentTitle ?? "GST consent"}
            summary={
              t.gstConsentSummary ??
              "Your GST registration number is collected as part of your application."
            }
            details={t.gstConsentDetails ?? ""}
            accepted={values.gst_consent ?? false}
            onChange={(accepted) => updateValue("gst_consent", accepted)}
            checkboxLabel={t.gstConsentLabel ?? "I consent to GST verification"}
            ariaLabel="GST consent"
          />
          <InlineFieldFeedback
            fieldId="gst_consent"
            state={touched.gst_consent && errors.gst_consent ? "error" : "idle"}
            messageTemplate={touched.gst_consent ? (errors.gst_consent ?? "") : ""}
          />
        </div>
      )}
    </div>
  );

  const renderRequirementsError = () => (
    <div className="space-y-3">
      <p className="text-sm text-nt-red-500" role="alert">
        {requirementsError}
      </p>
      <button
        type="button"
        onClick={() => void reloadRequirements()}
        disabled={requirementsLoading}
        className="rounded-md border border-nt-slate-300 px-4 py-2 text-sm font-semibold text-nt-slate-900 hover:bg-nt-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {requirementsLoading ? "Retrying…" : "Retry"}
      </button>
    </div>
  );

  const renderRequirementsErrorBanner = () => (
    <div className="mb-3 flex items-center justify-between gap-3 rounded-md bg-nt-red-500/10 px-4 py-2">
      <p className="text-sm text-nt-red-500" role="alert">
        {requirementsError}
      </p>
      <button
        type="button"
        onClick={() => void reloadRequirements()}
        disabled={requirementsLoading}
        className="shrink-0 text-sm font-semibold text-nt-slate-900 underline disabled:cursor-not-allowed disabled:opacity-60"
      >
        {requirementsLoading ? "Retrying…" : "Retry"}
      </button>
    </div>
  );

  const renderItr = () => {
    // Check the error first: once a fetch has failed, `requirements` stays
    // null forever, so checking `!requirements` first would show an
    // indefinite loading message instead of the real error.
    if (requirementsError && !requirements) {
      return renderRequirementsError();
    }
    if (!requirements) {
      return <p className="text-sm text-nt-slate-500">Loading your document checklist…</p>;
    }
    return (
      <>
        {requirementsError && renderRequirementsErrorBanner()}
        <DocumentChecklist
          requirements={requirements}
          onChange={setRequirements}
          filter={(row) => row.attaches_to !== "facility"}
          emptyMessage="No documents required for this application yet."
        />
      </>
    );
  };

  const renderBank = () => {
    if (requirementsError && !requirements) {
      return renderRequirementsError();
    }
    if (!requirements) {
      return <p className="text-sm text-nt-slate-500">Loading…</p>;
    }
    return (
      <>
        {requirementsError && renderRequirementsErrorBanner()}
        <ExistingLoansPanel
          ref={existingLoansPanelRef}
          requirements={requirements}
          onChange={setRequirements}
        />
      </>
    );
  };

  const renderReview = () => {
    // Every row below reads the persisted backend snapshot (`application`),
    // never the local `values` form state — `values` can lag another tab's
    // write even though `application` was itself fetched/merged from the
    // backend on every save and on resume. See Phase 6: "Review must render
    // persisted backend values/snapshots, not prefer stale client-side form
    // state."
    const primaryParty = application?.parties.find((party) => party.is_primary);
    const turnoverRange = application?.business_profile.annual_turnover_range;
    const gstRegistered = application?.business_profile.gst_registered;
    const rows: { label: string; value: string }[] = [
      {
        label: t.loanAmountLabel ?? "Loan amount",
        value: application?.values.requested_amount
          ? `₹${application.values.requested_amount.toLocaleString("en-IN")}`
          : "Not available",
      },
      {
        label: t.tenureLabel ?? "Tenure",
        value: application?.values.requested_tenure_months
          ? `${application.values.requested_tenure_months} months`
          : "Not available",
      },
      {
        label: t.purposeLabel ?? "Purpose",
        value:
          t.purposeLabels?.[application?.values.purpose ?? ""] ??
          application?.values.purpose ??
          "Not available",
      },
      { label: t.fullNameLabel ?? "Full name", value: primaryParty?.full_name ?? "Not available" },
      {
        label: t.mobileLabel ?? "Mobile number",
        value: primaryParty?.mobile_masked ?? "Not available",
      },
      {
        label: t.emailLabel ?? "Email",
        value: primaryParty?.email_masked ?? "Not available",
      },
      {
        label: t.pinCodeLabel ?? "Business PIN code",
        value: application?.business_profile.business_pincode ?? "Not available",
      },
      {
        label: t.aadhaarLabel ?? "Aadhaar",
        value: primaryParty?.identifiers.aadhaar_masked ?? "Not available",
      },
      {
        label: t.panLabel ?? "PAN",
        value: primaryParty?.identifiers.pan_masked ?? "Not available",
      },
      gstRegistered
        ? {
            label: t.gstinLabel ?? "GSTIN",
            value: application?.registrations.gstin_masked ?? "Not available",
          }
        : { label: t.gstinLabel ?? "GSTIN", value: "Not registered" },
      {
        label: t.annualTurnoverLabel ?? "Annual turnover",
        value: turnoverRange
          ? (t.turnoverRanges?.[turnoverRange] ?? turnoverRange)
          : "Not available",
      },
      {
        label: t.itrUploadLabel ?? "Documents",
        value: requirements
          ? `${requirements.requirements.filter((row) => row.status === "collected").length} of ${requirements.requirements.length} uploaded`
          : "Not available",
      },
      {
        label: t.linkBankLabel ?? "Existing loans",
        value:
          requirements?.credit_declaration.has_active_credit_facilities === true
            ? `${requirements.facilities.length} declared`
            : requirements?.credit_declaration.has_active_credit_facilities === false
              ? "None declared"
              : "Not available",
      },
    ];

    const outstandingRequirements = (requirements?.requirements ?? []).filter(
      (row) => row.blocks_submission && !SATISFIED_REQUIREMENT_STATUSES.has(row.status),
    );

    const toggleConsent = (purposeCode: string, checked: boolean) => {
      setConsentGrants((previous) => ({ ...previous, [purposeCode]: checked }));
    };

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

        {outstandingRequirements.length > 0 && (
          <div className="rounded-lg bg-nt-red-500/10 px-4 py-3 text-sm text-nt-red-500">
            <p className="font-semibold">Complete these before submitting:</p>
            <ul className="mt-1 list-disc pl-5">
              {outstandingRequirements.map((row) => (
                <li key={row.application_requirement_id}>{row.display_name}</li>
              ))}
            </ul>
          </div>
        )}

        {consentError && !consentStatus ? (
          <div className="space-y-3">
            <p className="text-sm text-nt-red-500" role="alert">
              {consentError}
            </p>
            <button
              type="button"
              onClick={() => void reloadConsent()}
              disabled={consentLoading}
              className="rounded-md border border-nt-slate-300 px-4 py-2 text-sm font-semibold text-nt-slate-900 hover:bg-nt-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {consentLoading ? "Retrying…" : "Retry"}
            </button>
          </div>
        ) : !consentStatus ? (
          <p className="text-sm text-nt-slate-500">Loading consent details…</p>
        ) : (
          <div className="space-y-3">
            {consentError && (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-md bg-nt-red-500/10 px-4 py-2">
                <p className="text-sm text-nt-red-500" role="alert">
                  {consentError}
                </p>
                <button
                  type="button"
                  onClick={() => void reloadConsent()}
                  disabled={consentLoading}
                  className="shrink-0 text-sm font-semibold text-nt-slate-900 underline disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {consentLoading ? "Retrying…" : "Retry"}
                </button>
              </div>
            )}
            {consentStatus.purposes.map((purpose) => (
              <label
                key={purpose.purpose_code}
                className="flex items-start gap-3 text-sm text-nt-slate-700"
              >
                <input
                  type="checkbox"
                  checked={consentGrants[purpose.purpose_code] ?? purpose.granted}
                  onChange={(e) => toggleConsent(purpose.purpose_code, e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-nt-slate-300 text-nt-orange-600 focus:ring-nt-orange-600"
                />
                <span>
                  <span>{purpose.display_name}</span>
                  {purpose.notice_text !== purpose.display_name && (
                    <span className="block text-xs text-nt-slate-500">{purpose.notice_text}</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderResult = () => {
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
            {submissionResultState?.application_no ??
              application?.application_no ??
              submissionResult?.reference_number ??
              values.application_reference ??
              "Not available"}
          </p>
        </div>
        <Link
          href={`/${locale}`}
          onClick={onComplete}
          className="inline-flex rounded-md bg-nt-orange-600 px-6 py-3 text-sm font-semibold text-white hover:bg-nt-orange-700"
        >
          {t.viewDashboardLabel ?? "Back to home"}
        </Link>
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

  const stepperSteps: WizardStepDefinition[] = steps.map((s) => ({
    id: s.id,
    title: s.title,
  }));

  return (
    <div className="mx-auto max-w-3xl rounded-3xl border border-nt-slate-200/80 bg-white p-4 shadow-xl shadow-slate-200/50 backdrop-blur-xs sm:p-10">
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

      {apiError && (
        <p
          className="mt-4 rounded-lg bg-nt-red-500/10 px-4 py-3 text-sm text-nt-red-500"
          role="alert"
        >
          {apiError}
        </p>
      )}

      {currentStepId !== "submission_result" && (
        <NavigationFooter
          showBack={currentIndex > 0}
          onBack={goBack}
          onContinue={handleContinue}
          continueDisabled={!canContinue || isSaving || isBootstrapping}
          continueLabel={
            isSaving ? "Saving..." : isReviewStep ? (t.submit ?? "Submit") : t.continue
          }
          backLabel={t.back}
          variant={isReviewStep ? "submit" : "continue"}
        />
      )}
    </div>
  );
}

function SavedValue({ value }: { value?: string | null }) {
  if (!value) return null;
  return <p className="text-xs text-nt-slate-500">Saved: {value}</p>;
}

function TextField({
  id,
  label,
  type = "text",
  value,
  onChange,
  error,
  inputMode,
  required,
}: {
  id: string;
  label: string;
  type?: string;
  value: string | number;
  onChange: (value: string) => void;
  error?: string;
  inputMode?: "text" | "numeric" | "tel";
  required?: boolean;
}) {
  const isRequired = required ?? !label.toLowerCase().includes("optional");
  return (
    <div>
      <label
        htmlFor={id}
        className={cn(
          "block text-xs font-semibold uppercase tracking-wider text-nt-slate-700",
          isRequired && "after:content-['*'] after:ml-1 after:text-nt-red-500 after:font-bold",
        )}
      >
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        inputMode={inputMode}
        required={isRequired}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}--feedback` : undefined}
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
  required,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
}) {
  const isRequired = required ?? !label.toLowerCase().includes("optional");
  return (
    <div>
      <label
        htmlFor={id}
        className={cn(
          "block text-xs font-semibold uppercase tracking-wider text-nt-slate-700",
          isRequired && "after:content-['*'] after:ml-1 after:text-nt-red-500 after:font-bold",
        )}
      >
        {label}
      </label>
      <select
        id={id}
        name={id}
        required={isRequired}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}--feedback` : undefined}
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
