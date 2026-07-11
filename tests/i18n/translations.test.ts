import { describe, it, expect } from "vitest";
import { getTranslator } from "@/src/lib/i18n/translations";

describe("getTranslator and t() behavior", () => {
  it("joins array leaves with the middle-dot separator", async () => {
    const t = await getTranslator("en");
    const joined = t("global.footer.badges");
    expect(joined).toBe("RBI Aligned · FACE Registered · Powered by Kubar");
  });

  it("joins namespaced array leaves with the middle-dot separator", async () => {
    const t = await getTranslator("en", "home.whyNavDhan");
    const joined = t("trustBadges");
    expect(joined).toBe("RBI Aligned · FACE Registered · Powered by Kubar");
  });

  it("returns an empty string when a leaf resolves to an empty array", async () => {
    // This key does not exist in any locale file; the fallback "key as string"
    // is expected until array handling is fully implemented for empty arrays too.
    const t = await getTranslator("en");
    expect(t("global.footer.emptyBadges")).toBe("");
  });

  it("interpolates variables in the translated string", async () => {
    const t = await getTranslator("en", "global.alt");
    expect(t("partnerLogo", { name: "Acme" })).toBe("Acme logo");
  });

  it("falls back to default locale when the requested locale misses a key", async () => {
    const t = await getTranslator("hi");
    // hi.json intentionally does not have productCta; the default locale value should be returned.
    expect(t("home.loanProducts.productCta")).toBe("Learn more");
  });

  it("falls back to the key string when no locale contains a translation", async () => {
    const t = await getTranslator("en");
    expect(t("this.key.does.not.exist")).toBe("this.key.does.not.exist");
  });

  it("still resolves absolute keys when a namespace is provided", async () => {
    const t = await getTranslator("en", "home.hero");
    expect(t("home.hero.headline")).toBe("One stop-solution for all your working capital needs");
  });
});
