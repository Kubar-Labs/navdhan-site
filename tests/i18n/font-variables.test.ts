import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("font variable registration via layout and theme", () => {
  const layoutSrc = readFileSync(resolve("app/[locale]/layout.tsx"), "utf8");
  const cssSrc = readFileSync(resolve("app/globals.css"), "utf8");

  it("loads Inter via the Next.js font mechanism and injects --font-inter", () => {
    expect(layoutSrc).toMatch(/from\s+["'](@next\/font\/google|next\/font\/google)["']/);
    expect(layoutSrc).toContain("Inter");
    expect(layoutSrc).toContain("--font-inter");
    // The variable must be wired to the root <html> element.
    expect(layoutSrc).toMatch(/<html[\s\S]*?className=[\s\S]*?--font-inter/);
  });

  it("loads Instrument Serif via the Next.js font mechanism and injects --font-instrument-serif", () => {
    expect(layoutSrc).toMatch(/Instrument[_\s]Serif/);
    expect(layoutSrc).toContain("--font-instrument-serif");
    expect(layoutSrc).toMatch(/<html[\s\S]*?className=[\s\S]*?--font-instrument-serif/);
  });

  it("keeps the required Devanagari and serif fallbacks in theme variables", () => {
    expect(cssSrc).toContain("var(--font-inter)");
    expect(cssSrc).toContain("var(--font-instrument-serif)");
    expect(cssSrc).toContain("Noto Sans Devanagari");
    expect(cssSrc).toContain("Georgia");
  });
});
