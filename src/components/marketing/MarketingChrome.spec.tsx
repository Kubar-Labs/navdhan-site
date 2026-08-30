/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => (
    <span role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={!alt} />
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/hi/how-it-works",
  useRouter: () => ({ prefetch: vi.fn() }),
}));

import { MarketingFooter, MarketingHeader } from "./MarketingChrome";

describe("marketing navigation", () => {
  afterEach(() => cleanup());

  it("links both new destinations in the active locale", () => {
    render(
      <>
        <MarketingHeader locale="hi" />
        <MarketingFooter locale="hi" />
      </>,
    );

    screen.getAllByRole("link", { name: "How It Works" }).forEach((link) => {
      expect(link).toHaveAttribute("href", "/hi/how-it-works");
    });
    screen.getAllByRole("link", { name: "Why NavDhan" }).forEach((link) => {
      expect(link).toHaveAttribute("href", "/hi/why-navdhan");
    });
    screen.getAllByRole("link", { name: "Team" }).forEach((link) => {
      expect(link).toHaveAttribute("href", "/hi/team");
    });
    expect(screen.getAllByRole("link", { name: "How It Works" })[0]).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
