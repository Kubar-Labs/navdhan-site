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
      className="mt-4 rounded-xl border border-nt-slate-200 bg-[#fafaf8] p-6"
    >
      <h3 className="text-sm font-semibold text-nt-slate-900">
        {title}
      </h3>
      <p className="mt-2 text-sm text-nt-slate-600">{summary}</p>
      <p className="mt-2 text-sm text-nt-slate-500">{details}</p>
      <div className="mt-4 flex items-start gap-3 text-sm text-nt-slate-700 select-none">
        <span
          role="checkbox"
          aria-checked={accepted}
          title={ariaLabel}
          tabIndex={0}
          onClick={() => onChange(!accepted)}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              onChange(!accepted);
            }
          }}
          className={cn(
            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border cursor-pointer focus:outline-none focus:ring-1 focus:ring-nt-orange-600 focus:ring-offset-1",
            accepted
              ? "bg-nt-orange-600 border-nt-orange-600 text-white"
              : "border-nt-slate-300 bg-white"
          )}
        >
          {accepted && (
            <svg
              className="h-3 w-3 stroke-[3]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </span>
        <span
          onClick={() => onChange(!accepted)}
          className="cursor-pointer"
        >
          {checkboxLabel}
        </span>
      </div>
    </section>
  );
}
