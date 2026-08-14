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
    <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row pt-4 border-t border-nt-slate-100">
      {showBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-xl border border-nt-slate-300/80 bg-white px-6 py-3.5 text-sm font-semibold text-nt-slate-700 shadow-xs hover:border-nt-slate-400 hover:bg-nt-slate-50 focus:outline-none focus:ring-2 focus:ring-nt-orange-600 focus:ring-offset-2 active:scale-[0.99] transition-all cursor-pointer"
        >
          {backLabel}
        </button>
      )}
      <button
        type="button"
        disabled={continueDisabled}
        onClick={onContinue}
        className="flex-1 rounded-xl bg-gradient-to-r from-nt-orange-600 to-nt-orange-500 px-6 py-3.5 text-sm font-semibold text-white shadow-md shadow-nt-orange-600/20 hover:from-nt-orange-700 hover:to-nt-orange-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none focus:outline-none focus:ring-2 focus:ring-nt-orange-600 focus:ring-offset-2 active:scale-[0.99] transition-all cursor-pointer"
      >
        <span className="flex items-center justify-center gap-2">
          {continueLabel}
          {variant !== "submit" && <ChevronRight className="h-4 w-4" />}
        </span>
      </button>
    </div>
  );
}
