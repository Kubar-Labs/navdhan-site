import { afterEach, describe, expect, it, vi } from "vitest";

import { extractSessionId, serializeSessionCookie } from "./session";

describe("extractSessionId", () => {
  it("matches only the exact protected cookie name", () => {
    expect(
      extractSessionId(
        "x__Host-nd_session=attacker; __Host-nd_session=legitimate",
      ),
    ).toBe("legitimate");
    expect(
      extractSessionId(
        "foo=__Host-nd_session=attacker; __Host-nd_session=legitimate",
      ),
    ).toBe("legitimate");
  });

  it("also matches the non-Secure dev cookie name", () => {
    expect(extractSessionId("nd_session=legitimate")).toBe("legitimate");
  });
});

describe("serializeSessionCookie", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    vi.stubEnv("NODE_ENV", originalEnv ?? "test");
  });

  it("uses the __Host- prefixed Secure cookie in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const cookie = serializeSessionCookie("token123");
    expect(cookie).toContain("__Host-nd_session=token123");
    expect(cookie).toContain("Secure");
  });

  it("drops __Host- and Secure outside production, since Secure cookies never persist over plain http://localhost", () => {
    vi.stubEnv("NODE_ENV", "development");
    const cookie = serializeSessionCookie("token123");
    expect(cookie).toContain("nd_session=token123");
    expect(cookie).not.toContain("__Host-");
    expect(cookie).not.toContain("Secure");
  });
});
