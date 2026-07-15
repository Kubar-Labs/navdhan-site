import { describe, it, expect } from "vitest";
import { loadLegalPage, legalSlugs } from "@/src/lib/legal/loader";
import { locales } from "@/src/lib/i18n/config";

const nonDefaultLocales = locales.filter((locale) => locale !== "en");

describe("legal page localization", () => {
  it.each(nonDefaultLocales)("locale %s returns localized titles and headings", async (locale) => {
    for (const slug of legalSlugs) {
      const enPage = await loadLegalPage("en", slug);
      const localizedPage = await loadLegalPage(locale, slug);

      expect(localizedPage.meta.title, `${slug} title should be localized for ${locale}`).not.toBe(
        enPage.meta.title,
      );
      expect(
        localizedPage.meta.description,
        `${slug} description should be localized for ${locale}`,
      ).not.toBe(enPage.meta.description);
      expect(
        localizedPage.intro.heading,
        `${slug} heading should be localized for ${locale}`,
      ).not.toBe(enPage.intro.heading);
    }
  });
});
