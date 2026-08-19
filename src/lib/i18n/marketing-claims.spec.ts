import { describe, expect, it } from "vitest";
import { getMessages } from "@/src/lib/i18n/messages";
import bn from "@/src/lib/i18n/messages/bn.json";
import te from "@/src/lib/i18n/messages/te.json";
import mr from "@/src/lib/i18n/messages/mr.json";
import ta from "@/src/lib/i18n/messages/ta.json";
import kn from "@/src/lib/i18n/messages/kn.json";
import ml from "@/src/lib/i18n/messages/ml.json";

describe("marketing claim safeguards", () => {
  it("uses collection-only copy instead of unverified time or fee promises", () => {
    const english = getMessages("en") as Record<string, Record<string, unknown>>;
    const hindi = getMessages("hi") as Record<string, Record<string, unknown>>;

    expect(JSON.stringify(english)).not.toMatch(
      /zero processing fee|under 5 minutes|less than 5 minutes|within 24 hours/i,
    );
    expect(JSON.stringify(hindi)).not.toMatch(/शून्य प्रोसेसिंग शुल्क|5 मिनट|24 घंट/);
    expect(english.global.announcement).toMatchObject({
      ctaLabel: "Start application",
    });
  });

  it("does not publish stale loan claims from incomplete locale packs", () => {
    for (const messages of [bn, te, mr, ta, kn, ml]) {
      expect(messages).not.toHaveProperty("home");
    }

    const englishHome = (getMessages("en") as Record<string, unknown>).home;
    for (const locale of ["bn", "te", "mr", "ta", "kn", "ml"]) {
      expect((getMessages(locale) as Record<string, unknown>).home).toEqual(englishHome);
    }
  });
});
