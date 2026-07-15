"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Container } from "@/src/components/layout/Container";
import { Logo } from "@/src/components/shells/Logo";
import { cn } from "@/src/lib/utils/cn";
import { Menu, X } from "lucide-react";
import { localeOptions, isValidLocale, type Locale } from "@/src/lib/i18n/config";

export interface NavLink {
  label: string;
  href: string;
}

export interface CtaButton {
  label: string;
  href: string;
  variant?: "primary" | "secondary";
}

export interface HeaderProps {
  navLinks: NavLink[];
  cta: CtaButton;
  currentLocale: string;
}

function stripLocalePrefix(pathname: string): string {
  const [, firstSegment, ...rest] = pathname.split("/");
  if (firstSegment && isValidLocale(firstSegment)) {
    return "/" + rest.join("/");
  }
  return pathname;
}

export function Header({ navLinks, cta, currentLocale }: HeaderProps) {
  const pathname = usePathname() ?? "/";
  const pathnameWithoutLocale = stripLocalePrefix(pathname);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-nt-slate-200 bg-nt-white/95 backdrop-blur">
      <Container size="default">
        <nav aria-label="Primary" className="flex h-16 items-center justify-between gap-4">
          <Link
            href={`/${currentLocale}`}
            className="focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nt-orange-600"
          >
            <Logo variant="dark" />
          </Link>

          <div className="flex items-center gap-2 md:gap-6">
            <ul className="hidden items-center gap-4 text-sm font-medium text-nt-slate-700 md:flex">
              {navLinks.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="hover:text-nt-slate-900 focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nt-orange-600"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

            <LocaleSelector
              currentLocale={currentLocale}
              pathnameWithoutLocale={pathnameWithoutLocale}
            />

            <Link
              href={cta.href}
              className={cn(
                "hidden rounded-md px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:inline-flex",
                cta.variant === "secondary"
                  ? "border border-nt-slate-300 text-nt-slate-900 hover:bg-nt-slate-50"
                  : "bg-nt-orange-600 text-white hover:bg-nt-orange-700",
                "focus-visible:outline-nt-orange-600",
              )}
            >
              {cta.label}
            </Link>

            <button
              type="button"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((open) => !open)}
              className="inline-flex rounded-md p-2 text-nt-slate-700 hover:bg-nt-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nt-orange-600 md:hidden"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>

        {mobileOpen && (
          <div className="border-t border-nt-slate-200 bg-white md:hidden">
            <ul className="flex flex-col gap-2 px-4 py-4 text-sm font-medium text-nt-slate-700">
              {navLinks.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="block rounded-md px-2 py-2 hover:bg-nt-slate-50 hover:text-nt-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nt-orange-600"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li className="pt-2">
                <Link
                  href={cta.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "block rounded-md px-4 py-2 text-center text-sm font-semibold",
                    cta.variant === "secondary"
                      ? "border border-nt-slate-300 text-nt-slate-900 hover:bg-nt-slate-50"
                      : "bg-nt-orange-600 text-white hover:bg-nt-orange-700",
                  )}
                >
                  {cta.label}
                </Link>
              </li>
            </ul>
          </div>
        )}
      </Container>
    </header>
  );
}

interface LocaleSelectorProps {
  currentLocale: string;
  pathnameWithoutLocale: string;
}

function LocaleSelector({ currentLocale, pathnameWithoutLocale }: LocaleSelectorProps) {
  return (
    <label className="flex items-center gap-2 text-sm text-nt-slate-700">
      <span className="sr-only">Choose language</span>
      <select
        value={currentLocale}
        onChange={(event) => {
          const locale = event.target.value as Locale;
          const target = `/${locale}${pathnameWithoutLocale || ""}`;
          window.location.href = target;
        }}
        className="rounded-md border border-nt-slate-300 bg-nt-white px-2 py-1.5 text-sm focus-visible:border-nt-orange-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nt-orange-600"
      >
        {localeOptions.map((option) => (
          <option key={option.value} value={option.value} lang={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
