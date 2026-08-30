import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import teamData from "@/src/lib/data/team.json";
import { locales } from "@/src/lib/i18n/config";

describe("approved Team page data", () => {
  it("publishes the Team route for every supported locale", () => {
    expect(existsSync(join(process.cwd(), "app/[locale]/(marketing)/team/page.tsx"))).toBe(true);
    const urls = sitemap().map(({ url }) => url);
    locales.forEach((locale) => {
      expect(urls).toContain(`https://navdhan.app/${locale}/team`);
    });
  });

  it("contains the six core team members in approved order", () => {
    expect(teamData.members.map(({ name, roleKey }) => [name, roleKey])).toEqual([
      ["Vaibhav Sharma", "Founder"],
      ["Rayansh Srivastava", "CTO"],
      ["Keshav Dudani", "Founding ML Engineer"],
      ["Manchit Sanan", "Compliance Lead"],
      ["Divyesh Reddy", "Partnerships Lead"],
      ["Kavish Mahajan", "Creative Director"],
    ]);
    expect(teamData.members.every(({ imageAsset }) => imageAsset.includes("/redesign/"))).toBe(
      true,
    );
  });

  it("contains the approved advisors and LinkedIn destinations", () => {
    expect(teamData.advisors.map(({ name, linkedIn }) => [name, linkedIn])).toEqual([
      ["Debayan Gupta", "https://www.linkedin.com/in/debayang/"],
      ["Amit Sagar", "https://www.linkedin.com/in/amit-sagar-59286768/"],
      ["Shridhar Sethuram", "https://www.linkedin.com/in/shridharsethuram/"],
      ["Tushar Jaruhar", "https://www.linkedin.com/in/tushar-jaruhar-9362959/"],
    ]);
    expect(teamData.joinHref).toBe("mailto:careers@navdhan.app");
  });
});
