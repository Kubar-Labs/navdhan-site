import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("font variable registration via layout and theme", () => {
  const layoutSrc = readFileSync(resolve("app/[locale]/layout.tsx"), "utf8");
  const cssSrc = readFileSync(resolve("app/globals.css"), "utf8");

  it("loads Inter via the Next.js font mechanism and injects --font-inter", () => {
    expect(layoutSrc).toMatch(/from\s+["']next\/font\/local["']/);
    expect(layoutSrc).toContain("inter-400.woff2");
    expect(layoutSrc).toContain("inter-700.woff2");
    expect(layoutSrc).toContain("--font-inter");
    // The variable must be wired to the root <html> element.
    expect(layoutSrc).toMatch(/<html[\s\S]*?className=[\s\S]*?--font-inter/);
  });

  it("loads display font via the Next.js font mechanism and injects display font variables", () => {
    expect(layoutSrc).toContain("instrument-serif.woff2");
    expect(layoutSrc).toContain("--font-safira-march");
    expect(layoutSrc).toMatch(/<html[\s\S]*?className=[\s\S]*?--font-safira-march/);
  });

  it("keeps the required Devanagari and sans fallbacks in theme variables", () => {
    expect(cssSrc).toContain("var(--font-inter)");
    expect(cssSrc).toContain("Helvetica");
    expect(cssSrc).toContain("Noto Sans Devanagari");
  });
});
