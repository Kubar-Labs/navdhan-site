"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useState } from "react";

interface AnnouncementBarProps {
  message: string;
  ctaLabel?: string;
  href?: string;
  dismissible?: boolean;
}

export function AnnouncementBar({
  message,
  ctaLabel,
  href = "#",
  dismissible = true,
}: AnnouncementBarProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="bg-nt-slate-900 px-4 py-2.5 text-center text-sm text-white">
      <span className="inline-flex flex-wrap items-center justify-center gap-2">
        <span>{message}</span>
        {ctaLabel && (
          <Link
            href={href}
            className="font-semibold text-nt-orange-300 underline underline-offset-2 hover:text-nt-orange-200"
          >
            {ctaLabel}
          </Link>
        )}
        {dismissible && (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss announcement"
            className="ml-2 inline-flex rounded p-0.5 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-nt-orange-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </span>
    </div>
  );
}
