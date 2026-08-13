"use client";

import { ApplyFormValues } from "./types";
import { STORAGE_KEY } from "./constants";

export function loadDraftValues(): ApplyFormValues | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ApplyFormValues;
  } catch {
    return null;
  }
}

export function saveDraftValues(values: ApplyFormValues): void {
  if (typeof window === "undefined") return;
  try {
    const safeDraft: ApplyFormValues = {
      constitution: values.constitution,
      loan_amount: values.loan_amount,
      tenure_months: values.tenure_months,
      purpose: values.purpose,
      referral_code: values.referral_code,
    };
    const definedDraft = Object.fromEntries(
      Object.entries(safeDraft).filter(([, value]) => value !== undefined),
    );
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(definedDraft));
  } catch {
    // Ignore quota/security errors.
  }
}

export function clearDraftValues(locale?: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    if (locale) window.localStorage.removeItem(`${STORAGE_KEY}-${locale}`);
  } catch {
    // Ignore.
  }
}
