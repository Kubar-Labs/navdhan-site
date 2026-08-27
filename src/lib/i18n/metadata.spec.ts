import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { legalSlugs, publishedLegalLocales } from "@/src/lib/legal/loader";
import { localizedAlternates } from "./metadata";

describe("localized search metadata", () => {
  it("canonicalizes an unpublished legal locale to English", () => {
    expect(localizedAlternates("bn", "/legal/privacy-policy", publishedLegalLocales)).toEqual({
      canonical: "/en/legal/privacy-policy",
      languages: {
        en: "/en/legal/privacy-policy",
        hi: "/hi/legal/privacy-policy",
        "x-default": "/en/legal/privacy-policy",
      },
    });
  });

  it("keeps explicit placeholder legal locales out of the sitemap", () => {
    const urls = sitemap().map((entry) => entry.url);
    const legalUrls = urls.filter((url) => url.includes("/legal/"));

    expect(legalUrls).toHaveLength(publishedLegalLocales.length * legalSlugs.length);
    expect(legalUrls.some((url) => url.includes("/bn/legal/"))).toBe(false);
    expect(legalUrls).toContain("https://navdhan.app/en/legal/privacy-policy");
    expect(legalUrls).toContain("https://navdhan.app/hi/legal/privacy-policy");
  });
});
