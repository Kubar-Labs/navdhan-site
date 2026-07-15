"use client";

import { useEffect, useState } from "react";
import { cn } from "@/src/lib/utils/cn";
import type { LegalTocEntry } from "@/src/types/legal";

export interface LegalTableOfContentsProps {
  sections: LegalTocEntry[];
  label?: string;
}

export function LegalTableOfContents({ sections, label = "Contents" }: LegalTableOfContentsProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => entry.target.id);

        if (visible.length > 0) {
          setActiveId(visible[0] || null);
        }
      },
      {
        rootMargin: "-20% 0px -60% 0px",
        threshold: 0,
      },
    );

    sections.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [sections]);

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      element.focus({ preventScroll: true });
      setActiveId(id);
    }
  };

  return (
    <>
      <details className="group lg:hidden">
        <summary className="cursor-pointer rounded-lg border border-nt-slate-200 bg-nt-cream/50 px-4 py-3 font-semibold text-nt-slate-900 focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nt-orange-600">
          {label}
        </summary>
        <ol className="mt-2 space-y-2 border-l-2 border-nt-slate-200 pl-4">
          {sections.map((section) => (
            <TocItem key={section.id} section={section} activeId={activeId} onClick={handleClick} />
          ))}
        </ol>
      </details>

      <nav aria-label="On this page" className="hidden lg:block">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-nt-slate-500">
          {label}
        </p>
        <ol className="space-y-3 border-l-2 border-nt-slate-200 pl-4">
          {sections.map((section) => (
            <TocItem key={section.id} section={section} activeId={activeId} onClick={handleClick} />
          ))}
        </ol>
      </nav>
    </>
  );
}

interface TocItemProps {
  section: LegalTocEntry;
  activeId: string | null;
  onClick: (event: React.MouseEvent<HTMLAnchorElement>, id: string) => void;
}

function TocItem({ section, activeId, onClick }: TocItemProps) {
  const isActive = activeId === section.id;

  return (
    <li
      className={cn(
        "-ml-[calc(1rem+2px)] border-l-2 pl-4 transition-colors",
        isActive
          ? "border-nt-orange-600 text-nt-orange-600"
          : "border-transparent text-nt-slate-600 hover:text-nt-slate-900",
      )}
    >
      <a
        href={`#${section.id}`}
        onClick={(event) => onClick(event, section.id)}
        aria-current={isActive ? "location" : undefined}
        className="block text-sm focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nt-orange-600"
      >
        {section.title}
      </a>
    </li>
  );
}
