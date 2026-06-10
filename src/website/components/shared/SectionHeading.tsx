import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Eyebrow } from "./Eyebrow";

/**
 * Standard section header: an {@link Eyebrow} label stacked above an `h2`.
 * Returns a fragment so the surrounding layout (spacing, alignment) stays
 * in the caller's hands. `headingClassName` tweaks the heading per section
 * (e.g. spacing or `text-balance`).
 */
export function SectionHeading({
  eyebrow,
  children,
  eyebrowClassName,
  headingClassName,
}: {
  eyebrow: ReactNode;
  children: ReactNode;
  eyebrowClassName?: string;
  headingClassName?: string;
}) {
  return (
    <>
      <Eyebrow className={eyebrowClassName}>{eyebrow}</Eyebrow>
      <h2
        className={cn(
          "text-heading text-balance text-ink md:text-heading-lg",
          headingClassName,
        )}
      >
        {children}
      </h2>
    </>
  );
}
