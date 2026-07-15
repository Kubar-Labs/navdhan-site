import { notFound } from "next/navigation";
import { legalPageSchema, type LegalPageSchema } from "@/src/lib/legal/schemas";
import { defaultLocale, isValidLocale } from "@/src/lib/i18n/config";

export const legalSlugs = [
  "privacy-policy",
  "terms-of-use",
  "fair-practices-code",
  "cookie-policy",
  "grievance-redressal",
  "rbi-dlg-disclosure",
  "consent-policy",
] as const;

export type LegalSlug = (typeof legalSlugs)[number];

export function isValidLegalSlug(value: string): boolean {
  if (value === "terms-of-service") return true;
  return (legalSlugs as readonly string[]).includes(value);
}

/**
 * Validates and loads legal page content.
 *
 * Falls back to the default locale (en) when the requested locale file fails to
 * load or validate. Unknown slugs trigger the Next.js not-found boundary.
 */
export async function loadLegalPage(locale: string, slug: string): Promise<LegalPageSchema> {
  if (!isValidLegalSlug(slug)) {
    notFound();
  }

  if (slug === "terms-of-service") {
    slug = "terms-of-use";
  }

  const candidates = isValidLocale(locale) ? [locale, defaultLocale] : [defaultLocale];

  let lastError: unknown;

  for (const candidate of candidates) {
    try {
      const module = await import(`@/content/legal/${candidate}/${slug}.json`);
      return legalPageSchema.parse(module.default);
    } catch (err) {
      lastError = err;
    }
  }

  // In development, surface the original failure so malformed content is caught
  // at build time. In production, fall back to the not-found page.
  if (process.env.NODE_ENV === "development" && lastError instanceof Error) {
    throw new Error(
      `Failed to load legal page content for ${locale}/${slug}: ${lastError.message}`,
    );
  }

  notFound();
}
