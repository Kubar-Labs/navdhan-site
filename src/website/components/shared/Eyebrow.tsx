import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Overline label above section headings. Brex system: small, uppercase,
 * wide-tracked, steel gray — quiet chrome, never the ember accent.
 */
export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-[13px] font-medium uppercase tracking-[0.08em] text-steel",
        className,
      )}
    >
      {children}
    </p>
  );
}
