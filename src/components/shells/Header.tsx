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
  skipToContentLabel?: string;
  primaryNavigationLabel?: string;
  languageSelectorLabel?: string;
  mobileMenuOpenLabel?: string;
  mobileMenuCloseLabel?: string;
  mobileNavigationLabel?: string;
}

function stripLocalePrefix(pathname: string): string {
  const [, firstSegment, ...rest] = pathname.split("/");
  if (firstSegment && isValidLocale(firstSegment)) {
    return "/" + rest.join("/");
  }
  return pathname;
}

export function Header({
  navLinks,
  cta,
  currentLocale,
  skipToContentLabel = "Skip to main content",
  primaryNavigationLabel = "Primary navigation",
  languageSelectorLabel = "Choose language",
  mobileMenuOpenLabel = "Open menu",
  mobileMenuCloseLabel = "Close menu",
  mobileNavigationLabel = "Mobile navigation",
}: HeaderProps) {
  const pathname = usePathname() ?? "/";
  const pathnameWithoutLocale = stripLocalePrefix(pathname);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-nt-slate-200 bg-nt-white/95 backdrop-blur">
      <a
        href="#main-content"
        className="sr-only absolute left-4 top-3 z-50 rounded-md bg-white px-4 py-2 font-semibold text-nt-slate-900 shadow focus:not-sr-only focus:absolute"
      >
        {skipToContentLabel}
      </a>
      <Container size="default">
        <nav
          aria-label={primaryNavigationLabel}
          className="flex h-16 items-center justify-between gap-4"
        >
          <Link
            href={`/${currentLocale}`}
            className="focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nt-orange-600"
          >
            <Logo variant="dark" priority />
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
              label={languageSelectorLabel}
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
              aria-label={mobileOpen ? mobileMenuCloseLabel : mobileMenuOpenLabel}
              aria-expanded={mobileOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMobileOpen((open) => !open)}
              className="inline-flex rounded-md p-2 text-nt-slate-700 hover:bg-nt-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nt-orange-600 md:hidden"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>

        <nav
          id="mobile-navigation"
          aria-label={mobileNavigationLabel}
          hidden={!mobileOpen}
          className="border-t border-nt-slate-200 bg-white md:hidden"
        >
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
                    "block rounded-md px-4 py-2 text-center text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nt-orange-600",
                    cta.variant === "secondary"
                      ? "border border-nt-slate-300 text-nt-slate-900 hover:bg-nt-slate-50"
                      : "bg-nt-orange-600 text-white hover:bg-nt-orange-700",
                  )}
                >
                  {cta.label}
                </Link>
              </li>
            </ul>
        </nav>
      </Container>
    </header>
  );
}

interface LocaleSelectorProps {
  currentLocale: string;
  pathnameWithoutLocale: string;
  label: string;
}

function LocaleSelector({ currentLocale, pathnameWithoutLocale, label }: LocaleSelectorProps) {
  return (
    <label className="flex items-center gap-2 text-sm text-nt-slate-700">
      <span className="sr-only">{label}</span>
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
