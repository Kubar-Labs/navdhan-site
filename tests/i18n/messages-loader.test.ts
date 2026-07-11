import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const messagesDir = resolve("src/lib/i18n/messages");
const messagesModule = resolve("src/lib/i18n/messages.ts");

describe("locale message loader consolidation", () => {
  it("removes all .ts message source files from src/lib/i18n/messages", () => {
    const entries = readdirSync(messagesDir);
    const tsSources = entries.filter((name) => name.endsWith(".ts") && !name.endsWith(".d.ts"));
    expect(tsSources, "legacy .ts message files must be deleted").toEqual([]);
  });

  it("keeps exactly one JSON file per supported locale", () => {
    const entries = readdirSync(messagesDir);
    const jsonFiles = entries.filter((name) => name.endsWith(".json"));
    expect(jsonFiles.map((name) => name.replace(".json", "")).sort()).toEqual([
      "bn",
      "en",
      "hi",
      "kn",
      "ml",
      "mr",
      "ta",
      "te",
    ]);
  });

  it("statically imports JSON translation modules from messages.ts", () => {
    expect(existsSync(messagesModule)).toBe(true);
    const src = readFileSync(messagesModule, "utf8");

    for (const locale of ["en", "hi", "bn", "te", "mr", "ta", "kn", "ml"]) {
      expect(src).toMatch(new RegExp(`from\\s+["']\\.?\\/?messages\\/${locale}\\.json["']`));
      expect(src).not.toContain(`${locale}.ts`);
    }
  });
});
