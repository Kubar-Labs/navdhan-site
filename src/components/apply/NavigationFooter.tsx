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
          className="flex-1 rounded-xl border border-nt-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-nt-slate-900 hover:bg-nt-slate-50 hover:border-nt-slate-300 transition-all duration-200 shadow-sm focus:outline-none focus:ring-4 focus:ring-nt-orange-500/10"
        >
          {backLabel}
        </button>
      )}
      <button
        type={variant === "submit" ? "submit" : "button"}
        disabled={continueDisabled}
        onClick={variant === "submit" ? undefined : onContinue}
        className="flex-1 rounded-xl bg-gradient-to-r from-nt-orange-500 to-nt-orange-600 px-6 py-3.5 text-sm font-semibold text-white hover:from-nt-orange-600 hover:to-nt-orange-700 disabled:opacity-50 disabled:pointer-events-none shadow-[0_4px_12px_rgba(234,88,12,0.15)] transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-nt-orange-500/10"
      >
        <span className="flex items-center justify-center gap-2">
          {continueLabel}
          {variant !== "submit" && <ChevronRight className="h-4 w-4" />}
        </span>
      </button>
    </div>
  );
}
