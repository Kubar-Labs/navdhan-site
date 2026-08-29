import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { locales } from "@/src/lib/i18n/config";

describe("informational marketing routes", () => {
  it("provides both App Router page modules", () => {
    expect(existsSync(join(process.cwd(), "app/[locale]/(marketing)/why-navdhan/page.tsx"))).toBe(
      true,
    );
    expect(existsSync(join(process.cwd(), "app/[locale]/(marketing)/how-it-works/page.tsx"))).toBe(
      true,
    );
  });

  it("publishes both routes for every supported locale", () => {
    const urls = sitemap().map(({ url }) => url);

    locales.forEach((locale) => {
      expect(urls).toContain(`https://navdhan.app/${locale}/why-navdhan`);
      expect(urls).toContain(`https://navdhan.app/${locale}/how-it-works`);
    });
  });
});
