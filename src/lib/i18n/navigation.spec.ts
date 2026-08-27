import { describe, expect, it } from "vitest";
import { localizedUrl } from "./navigation";

describe("localizedUrl", () => {
  it("replaces the locale while retaining the current route", () => {
    expect(localizedUrl("/en/apply", "hi")).toBe("/hi/apply");
  });

  it("preserves query parameters and fragments", () => {
    expect(localizedUrl("/hi/team", "bn", "?ref=partner", "#members")).toBe(
      "/bn/team?ref=partner#members",
    );
  });

  it("adds a locale to an unlocalized path", () => {
    expect(localizedUrl("/apply", "ta")).toBe("/ta/apply");
  });
});
