import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getTranslator } from "@/src/lib/i18n/translations";
import { locales } from "@/src/lib/i18n/config";

const applyPagePath = resolve("app/apply/page.tsx");

const applyKeys = [
  "meta.title",
  "meta.description",
  "heading",
  "description",
  "loanDetailsTitle",
  "amountLabel",
  "tenureLabel",
  "purposeLabel",
  "aboutYouTitle",
  "fullNameLabel",
  "mobileLabel",
  "emailLabel",
  "pinCodeLabel",
  "emiLabel",
  "submit",
  "submitting",
  "successHeading",
  "errorHeading",
  "fieldRequired",
  "validation.mobileInvalid",
  "validation.emailInvalid",
];

describe("apply form translation parity", () => {
  it("apply page dynamically loads apply namespace translations", () => {
    expect(existsSync(applyPagePath)).toBe(true);
    const src = readFileSync(applyPagePath, "utf8");
    expect(src).toMatch(/getTranslator|useTranslator|useTranslations/);
    expect(src).not.toMatch(
      /("|').*?(Full Name|Full name|Mobile number|Email|PIN code|मोबाइल|ईमेल)/,
    );
  });

  it.each(locales)("loads the apply namespace for locale %s", async (locale) => {
    const t = await getTranslator(locale, "apply");

    for (const key of applyKeys) {
      const value = t(key);
      expect(value, `apply.${key} must resolve to a string for ${locale}`).toBeTypeOf("string");
      expect(value, `apply.${key} must not fall back to the raw key for ${locale}`).not.toBe(key);
    }
  });
});
