"use client";

import { STORAGE_KEY } from "./constants";

export function clearDraftValues(locale?: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    if (locale) window.localStorage.removeItem(`${STORAGE_KEY}-${locale}`);
  } catch {
    // Ignore.
  }
}
