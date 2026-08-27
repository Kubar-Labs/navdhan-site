import { describe, expect, it } from "vitest";
import { resolveApplyIntakeMode } from "./intake-mode";

describe("application intake mode", () => {
  it("fails closed in production when configuration is missing or invalid", () => {
    expect(resolveApplyIntakeMode(undefined, "production")).toBe("paused");
    expect(resolveApplyIntakeMode("unexpected", "production")).toBe("paused");
  });

  it("keeps local development and tests usable by default", () => {
    expect(resolveApplyIntakeMode(undefined, "development")).toBe("staging");
    expect(resolveApplyIntakeMode(undefined, "test")).toBe("staging");
  });

  it("accepts only the three explicit modes", () => {
    expect(resolveApplyIntakeMode(" paused ", "production")).toBe("paused");
    expect(resolveApplyIntakeMode("staging", "production")).toBe("staging");
    expect(resolveApplyIntakeMode("live", "production")).toBe("live");
  });
});
