import type { Metadata } from "next";
import { defaultLocale, locales, type Locale } from "./config";

function normalizePath(path: string): string {
  if (!path || path === "/") return "";
  return path.startsWith("/") ? path : `/${path}`;
}

export function localizedAlternates(
  locale: Locale,
  path = "",
  availableLocales: readonly Locale[] = locales,
): NonNullable<Metadata["alternates"]> {
  const suffix = normalizePath(path);
  const canonicalLocale = availableLocales.includes(locale) ? locale : defaultLocale;
  return {
    canonical: `/${canonicalLocale}${suffix}`,
    languages: {
      ...Object.fromEntries(
        availableLocales.map((candidate) => [candidate, `/${candidate}${suffix}`]),
      ),
      "x-default": `/${defaultLocale}${suffix}`,
    },
  };
}
