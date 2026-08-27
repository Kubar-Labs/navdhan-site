"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/src/components/shells/Logo";
import { ButtonLink, MarketingContainer } from "@/src/components/marketing/MarketingUI";
import { Menu, X } from "lucide-react";
import { localeOptions, isValidLocale, type Locale } from "@/src/lib/i18n/config";

export interface HeaderProps {
  currentLocale: string;
}

function stripLocalePrefix(pathname: string): string {
  const [, firstSegment, ...rest] = pathname.split("/");
  if (firstSegment && isValidLocale(firstSegment)) {
    return "/" + rest.join("/");
  }
  return pathname;
}

type Audience = "borrowers" | "platforms" | "lenders";

function getAudience(pathnameWithoutLocale: string): Audience | null {
  if (pathnameWithoutLocale === "/") return "borrowers";
  if (pathnameWithoutLocale === "/platforms") return "platforms";
  if (pathnameWithoutLocale === "/lenders") return "lenders";
  return null;
}

function audiencePath(locale: string, audience: Audience): string {
  if (audience === "platforms") return `/${locale}/platforms`;
  if (audience === "lenders") return `/${locale}/lenders`;
  return `/${locale}`;
}

export function Header({ currentLocale }: HeaderProps) {
  const pathname = usePathname() ?? "/";
  const pathnameWithoutLocale = stripLocalePrefix(pathname);
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeAudience = getAudience(pathnameWithoutLocale);
  const contextualAudience = activeAudience ?? "borrowers";
  const navLinks: { label: string; href: string; audience?: Audience }[] = [
    { label: "Borrowers", href: `/${currentLocale}`, audience: "borrowers" },
    { label: "For Platforms", href: `/${currentLocale}/platforms`, audience: "platforms" },
    { label: "For Lenders", href: `/${currentLocale}/lenders`, audience: "lenders" },
    {
      label: "How it works",
      href: `${audiencePath(currentLocale, contextualAudience)}#how-it-works`,
    },
  ];
  const cta =
    contextualAudience === "platforms"
      ? {
          label: "Explore integration",
          href: "mailto:partnerships@kubar.tech?subject=NavDhan%20platform%20integration",
        }
      : contextualAudience === "lenders"
        ? {
            label: "Request briefing",
            href: "mailto:partnerships@kubar.tech?subject=NavDhan%20lender%20briefing",
          }
        : { label: "Check eligibility", href: `/${currentLocale}/apply` };

  return (
    <header className="sticky top-0 z-50 border-b border-nt-slate-200 bg-white/95 backdrop-blur">
      <a
        href="#main-content"
        className="sr-only left-4 top-4 z-[60] rounded-xl bg-white px-4 py-3 text-sm font-semibold text-nt-slate-900 shadow-lg focus:not-sr-only focus:fixed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nt-orange-700"
      >
        Skip to content
      </a>
      <MarketingContainer>
        <nav
          aria-label="Primary"
          className="flex min-h-[68px] items-center justify-between gap-4 py-2"
        >
          <Link
            href={`/${currentLocale}`}
            className="shrink-0 focus-visible:rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nt-orange-700"
          >
            <Logo variant="dark" />
          </Link>

          <div className="flex items-center gap-3 lg:gap-5">
            <ul className="hidden items-center gap-1 text-sm font-semibold text-nt-slate-600 lg:flex">
              {navLinks.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={item.audience === activeAudience ? "page" : undefined}
                    className={
                      item.audience === activeAudience
                        ? "block rounded-full bg-nt-orange-50 px-3 py-2 text-nt-orange-700"
                        : "block rounded-full px-3 py-2 hover:bg-nt-slate-50 hover:text-nt-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nt-orange-700"
                    }
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="hidden xl:block">
              <LocaleSelector
                currentLocale={currentLocale}
                pathnameWithoutLocale={pathnameWithoutLocale}
              />
            </div>

            <ButtonLink href={cta.href} className="hidden lg:inline-flex">
              {cta.label}
            </ButtonLink>

            <button
              type="button"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((open) => !open)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-nt-slate-200 bg-nt-slate-50 text-nt-slate-700 hover:bg-nt-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nt-orange-700 lg:hidden"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>

        {mobileOpen ? (
          <div className="border-t border-nt-slate-200 bg-white pb-4 lg:hidden">
            <ul className="flex flex-col gap-1 pt-4 text-sm font-semibold text-nt-slate-700">
              {navLinks.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={item.audience === activeAudience ? "page" : undefined}
                    onClick={() => setMobileOpen(false)}
                    className={
                      item.audience === activeAudience
                        ? "block rounded-xl bg-nt-orange-50 px-3 py-3 text-nt-orange-700"
                        : "block rounded-xl px-3 py-3 hover:bg-nt-slate-50 hover:text-nt-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nt-orange-700"
                    }
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li className="flex flex-col gap-4 pt-3">
                <LocaleSelector
                  currentLocale={currentLocale}
                  pathnameWithoutLocale={pathnameWithoutLocale}
                />
                <ButtonLink href={cta.href} className="w-full">
                  {cta.label}
                </ButtonLink>
              </li>
            </ul>
          </div>
        ) : null}
      </MarketingContainer>
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
          const suffix = pathnameWithoutLocale === "/" ? "" : pathnameWithoutLocale;
          const target = `/${locale}${suffix}`;
          window.location.href = target;
        }}
        className="min-h-10 rounded-xl border border-nt-slate-300 bg-white px-3 py-2 text-sm focus-visible:border-nt-orange-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nt-orange-700"
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
