/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ImgHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import teamData from "@/src/lib/data/team.json";

vi.mock("next/image", () => ({
  default: ({
    fill,
    priority,
    alt = "",
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
    void fill;
    void priority;
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={alt} {...props} />;
  },
}));

import { TeamPage } from "./TeamPage";

describe("TeamPage", () => {
  afterEach(() => cleanup());

  it("renders the approved English structure and roster copy", async () => {
    render(await TeamPage({ locale: "en" }));

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Built by people who believe in small business.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Meet the team." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Our advisors." })).toBeInTheDocument();
    expect(screen.getByText("Partnerships Lead")).toBeInTheDocument();
    ["The people behind NavDhan", "Our mission", "Core team", "Advisors", "Work with us"].forEach(
      (label) => expect(screen.queryByText(label)).not.toBeInTheDocument(),
    );

    teamData.members.forEach((member) => {
      expect(screen.getByRole("heading", { level: 3, name: member.name })).toBeInTheDocument();
      expect(screen.getByAltText(`Portrait of ${member.name}`)).toHaveAttribute(
        "sizes",
        expect.stringContaining("394px"),
      );
    });
    teamData.advisors.forEach((advisor) => {
      expect(screen.getByAltText(`Portrait of ${advisor.name}`)).toBeInTheDocument();
    });
  });

  it("uses approved safe external links and the verified careers destination", async () => {
    render(await TeamPage({ locale: "en" }));

    [...teamData.members, ...teamData.advisors].forEach((person) => {
      const link = screen.getByRole("link", {
        name: `${person.name} on LinkedIn (opens in a new tab)`,
      });
      expect(link).toHaveAttribute("href", person.linkedIn);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });
    expect(screen.getByRole("link", { name: /join the team/i })).toHaveAttribute(
      "href",
      "mailto:careers@navdhan.app",
    );
  });

  it("keeps the six-image hero collage decorative and in roster order", async () => {
    const { container } = render(await TeamPage({ locale: "en" }));
    const collage = container.querySelector('[aria-hidden="true"]');

    expect(collage).not.toBeNull();
    const portraits = within(collage as HTMLElement).getAllByTestId("hero-portrait");
    expect(portraits).toHaveLength(6);
    expect(portraits.map((portrait) => portrait.querySelector("img")?.getAttribute("src"))).toEqual(
      teamData.members.map((member) => member.imageAsset),
    );
    portraits.forEach((portrait) => {
      expect(portrait.querySelector("img")).toHaveAttribute("alt", "");
    });
  });
});
