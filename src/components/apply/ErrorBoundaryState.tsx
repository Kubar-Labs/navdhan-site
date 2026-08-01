"use client";

import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";
import { cn } from "@/src/lib/utils/cn";

export interface ErrorBoundaryStateProps {
  titleKey: string;
  bodyKey: string;
  retryCtaKey: string;
  reference?: string;
  onRetry: () => void;
}

function maskReference(reference?: string): string {
  if (!reference || reference.length < 8) return reference ?? "";
  return `${reference.slice(0, 3)}${"*".repeat(reference.length - 6)}${reference.slice(-3)}`;
}

export function ErrorBoundaryState({
  titleKey,
  bodyKey,
  retryCtaKey,
  reference,
  onRetry,
}: ErrorBoundaryStateProps) {
  return (
    <div
      className={cn(
        "mx-auto max-w-xl rounded-2xl border border-nt-red-200 bg-white p-6 text-center shadow-sm md:p-10",
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-nt-red-500/10 text-nt-red-500">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h2 className="mt-6 text-xl font-semibold text-nt-slate-900 md:text-2xl">{titleKey}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-nt-slate-600">{bodyKey}</p>

      {reference && (
        <div className="mt-6 rounded-lg bg-nt-cream p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-nt-slate-500">
            Support reference
          </p>
          <p className="mt-1 font-mono text-sm font-semibold text-nt-slate-800">
            {maskReference(reference)}
          </p>
        </div>
      )}

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 rounded-md border border-nt-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-nt-slate-900 hover:bg-nt-slate-50"
        >
          <Home className="h-4 w-4" />
          Home
        </Link>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-nt-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-nt-orange-700"
        >
          <RotateCcw className="h-4 w-4" />
          {retryCtaKey}
        </button>
      </div>
    </div>
  );
}
