import { afterEach, describe, expect, it, vi } from "vitest";

import {
  extractSessionId,
  serializeOppositeSessionCookieExpiry,
  serializeSessionCookie,
} from "./session";

describe("extractSessionId", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    vi.stubEnv("NODE_ENV", originalEnv ?? "test");
  });

  it("matches only the exact protected cookie name", () => {
    vi.stubEnv("NODE_ENV", "production");
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

  it("accepts only the protected cookie name in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(extractSessionId("nd_session=attacker")).toBeNull();
    expect(
      extractSessionId(
        "nd_session=attacker; __Host-nd_session=legitimate",
      ),
    ).toBe("legitimate");
  });

  it("accepts only the plain cookie name in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(extractSessionId("nd_session=legitimate")).toBe("legitimate");
    expect(extractSessionId("__Host-nd_session=attacker")).toBeNull();
    expect(
      extractSessionId(
        "__Host-nd_session=attacker; nd_session=legitimate",
      ),
    ).toBe("legitimate");
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

  it("drops __Host- and Secure in development, since Secure cookies never persist over plain http://localhost", () => {
    vi.stubEnv("NODE_ENV", "development");
    const cookie = serializeSessionCookie("token123");
    expect(cookie).toContain("nd_session=token123");
    expect(cookie).not.toContain("__Host-");
    expect(cookie).not.toContain("Secure");
  });

  it("expires the unprotected cookie name when production issues a session", () => {
    vi.stubEnv("NODE_ENV", "production");
    const cookie = serializeOppositeSessionCookieExpiry();
    expect(cookie).toContain("nd_session=");
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).not.toContain("__Host-");
  });

  it("expires the protected cookie name when development issues a session", () => {
    vi.stubEnv("NODE_ENV", "development");
    const cookie = serializeOppositeSessionCookieExpiry();
    expect(cookie).toContain("__Host-nd_session=");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("Max-Age=0");
  });
});
