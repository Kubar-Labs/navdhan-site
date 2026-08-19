"use client";

import { cn } from "@/src/lib/utils/cn";

export interface ConsentOverlayProps {
  title: string;
  summary: string;
  details: string;
  accepted: boolean;
  onChange: (accepted: boolean) => void;
  checkboxLabel: string;
  ariaLabel?: string;
}

export function ConsentOverlay({
  title,
  summary,
  details,
  accepted,
  onChange,
  checkboxLabel,
  ariaLabel,
}: ConsentOverlayProps) {
  return (
    <section
      className={cn(
        "mt-4 rounded-xl border p-5 sm:p-6 transition-all duration-200",
        accepted
          ? "border-nt-orange-600/40 bg-orange-50/20 shadow-xs"
          : "border-nt-slate-200 bg-nt-cream/50 hover:border-nt-slate-300 hover:bg-nt-cream",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-nt-slate-900 tracking-tight">{title}</h3>
          <p className="mt-1 text-sm text-nt-slate-600 leading-relaxed">{summary}</p>
          {details && <p className="mt-1 text-xs text-nt-slate-500 leading-relaxed">{details}</p>}
        </div>
      </div>

      <label className="mt-4 flex cursor-pointer items-center gap-3 border-t border-nt-slate-200/60 pt-3 select-none">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => onChange(event.target.checked)}
          aria-label={ariaLabel ?? checkboxLabel}
          required
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all peer-focus-visible:ring-2 peer-focus-visible:ring-nt-orange-600 peer-focus-visible:ring-offset-2",
            accepted
              ? "bg-nt-orange-600 border-nt-orange-600 text-white shadow-xs scale-105"
              : "border-nt-slate-300 bg-white hover:border-nt-orange-500",
          )}
        >
          {accepted && (
            <svg
              className="h-3.5 w-3.5 stroke-[3]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </span>
        <span className="text-sm font-medium text-nt-slate-800 hover:text-nt-slate-900">
          {checkboxLabel}
        </span>
      </label>
    </section>
  );
}
