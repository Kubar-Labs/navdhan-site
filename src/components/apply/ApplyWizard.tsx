"use client";

import { useMemo } from "react";
import { WizardShell, type WizardMessages } from "@/app/apply/_components/WizardShell";
import { STEP_ORDER } from "@/app/apply/lib/constants";
import { WizardStepId } from "@/app/apply/lib/types";

export type ApplyMessages = Partial<WizardMessages>;

interface ApplyWizardProps {
  locale: string;
  applicationId?: string;
  initialStep?: WizardStepId;
  messages?: ApplyMessages;
  onComplete?: () => void;
}

function mapApplyMessages(messages: ApplyMessages = {}): WizardMessages {
  const validationObj =
    typeof messages.validation === "object" && messages.validation !== null
      ? (messages.validation as Record<string, string>)
      : {};

  return {
    ...messages,
    loanAmountLabel: messages.loanAmountLabel ?? messages.amountLabel ?? undefined,
    fullNameLabel: messages.fullNameLabel ?? undefined,
    mobileLabel: messages.mobileLabel ?? undefined,
    mobilePlaceholder:
      messages.mobilePlaceholder ?? (messages.mobileLabel ? `${messages.mobileLabel}` : undefined),
    emailLabel: messages.emailLabel ?? undefined,
    pinCodeLabel: messages.pinCodeLabel ?? undefined,
    purposeLabels:
      messages.purposeLabels ??
      (typeof messages.purposes === "object" && messages.purposes !== null
        ? (messages.purposes as Record<string, string>)
        : undefined),
    submit: messages.submit ?? undefined,
    submitting: messages.submitting ?? undefined,
    invalidMobile:
      messages.invalidMobile ?? validationObj.mobileInvalid ?? validationObj.invalidMobile,
    invalidEmail: messages.invalidEmail ?? validationObj.emailInvalid ?? validationObj.invalidEmail,
    invalidName: messages.invalidName ?? validationObj.nameInvalid ?? validationObj.invalidName,
    invalidPinCode:
      messages.invalidPinCode ?? validationObj.pinCodeInvalid ?? validationObj.invalidPinCode,
    invalidAadhaar: messages.invalidAadhaar ?? validationObj.invalidAadhaar,
    invalidPan: messages.invalidPan ?? validationObj.invalidPan,
    invalidGstin: messages.invalidGstin ?? validationObj.invalidGstin,
    invalidLoanAmount:
      messages.invalidLoanAmount ?? validationObj.amountInvalid ?? validationObj.invalidLoanAmount,
    invalidTenure:
      messages.invalidTenure ?? validationObj.tenureInvalid ?? validationObj.invalidTenure,
    invalidPurpose:
      messages.invalidPurpose ?? validationObj.purposeInvalid ?? validationObj.invalidPurpose,
    invalidItr: messages.invalidItr ?? validationObj.invalidItr,
    back: messages.back ?? messages.wizard?.back ?? "Back",
    continue: messages.continue ?? messages.wizard?.next ?? "Continue",
    privacyConsentLabel:
      messages.privacyConsentLabel ??
      `${messages.consentDataPrefix ?? "I agree to"} ${messages.privacyPolicy ?? "Privacy Policy"}`,
    termsConsentLabel:
      messages.termsConsentLabel ??
      `${messages.consentDataPrefix ?? "I agree to"} ${messages.consentPolicy ?? "Consent Policy"}`,
  };
}

/**
 * Production-facing entry point for the loan application wizard.
 * It maps the i18n "apply" namespace to the messages expected by
 * the test-compatible WizardShell underneath.
 */
export function ApplyWizard({
  locale,
  applicationId,
  initialStep = "loan_intent",
  messages = {},
  onComplete,
}: ApplyWizardProps) {
  const mappedMessages = useMemo(() => mapApplyMessages(messages), [messages]);

  const steps = useMemo(
    () =>
      STEP_ORDER.map((step) => ({
        id: step.id,
        title: messages?.wizard?.stepTitles?.[step.id] ?? step.title,
        description: step.description,
      })),
    [messages],
  );

  return (
    <WizardShell
      locale={locale}
      steps={steps}
      initialStepId={initialStep}
      messages={mappedMessages}
      onComplete={onComplete}
    />
  );
}

ApplyWizard.displayName = "ApplyWizard";
