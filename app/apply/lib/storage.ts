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
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  } catch {
    // Ignore quota/security errors.
  }
}

export function clearDraftValues(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
