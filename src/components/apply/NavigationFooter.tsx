"use client";

import { ChevronRight } from "lucide-react";

export interface NavigationFooterProps {
  onBack?: () => void;
  onContinue?: () => void;
  backLabel?: string;
  continueLabel?: string;
  continueDisabled?: boolean;
  showBack?: boolean;
  variant?: "submit" | "continue";
}

export function NavigationFooter({
  onBack,
  onContinue,
  backLabel = "Back",
  continueLabel = "Continue",
  continueDisabled = false,
  showBack = false,
  variant = "continue",
}: NavigationFooterProps) {
  return (
    <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row">
      {showBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-md border border-nt-slate-300 bg-white px-6 py-3 text-sm font-semibold text-nt-slate-900 hover:bg-nt-slate-50 focus:outline-none focus:ring-2 focus:ring-nt-orange-600 focus:ring-offset-2"
        >
          {backLabel}
        </button>
      )}
      <button
        type={variant === "submit" ? "submit" : "button"}
        disabled={continueDisabled}
        onClick={variant === "submit" ? undefined : onContinue}
        className="flex-1 rounded-md bg-nt-orange-600 px-6 py-3 text-sm font-semibold text-white hover:bg-nt-orange-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-nt-orange-600 focus:ring-offset-2"
      >
        <span className="flex items-center justify-center gap-2">
          {continueLabel}
          {variant !== "submit" && <ChevronRight className="h-4 w-4" />}
        </span>
      </button>
    </div>
  );
}
