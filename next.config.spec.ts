import { describe, expect, it } from "vitest";
import nextConfig, { buildSecurityHeaders, SECURITY_HEADERS } from "./next.config";

describe("Next development watcher configuration", () => {
  it("preserves Next's RegExp defaults and ignores local document fixtures", () => {
    const webpack = nextConfig.webpack;
    expect(webpack).toBeTypeOf("function");

    const config = { watchOptions: { ignored: /node_modules|\.next/ } };
    const result = webpack?.(config, { dev: true } as never);
    const ignored = result?.watchOptions?.ignored;

    expect(ignored).toBeInstanceOf(RegExp);
    expect(ignored).toMatchObject({ source: expect.stringContaining("node_modules") });
    expect(ignored.test("/workspace/node_modules/react/index.js")).toBe(true);
    expect(ignored.test("/workspace/.next/cache/file")).toBe(true);
    expect(ignored.test("/workspace/dsa_portal/backend/.local_documents/file.pdf")).toBe(true);
  });
});

describe("global response hardening", () => {
  it("disables the framework banner and returns the audited header set", async () => {
    expect(nextConfig.poweredByHeader).toBe(false);
    expect(nextConfig.headers).toBeTypeOf("function");

    const rules = await nextConfig.headers?.();
    expect(rules).toEqual(
      expect.arrayContaining([
        { source: "/:path*", headers: [...SECURITY_HEADERS] },
        expect.objectContaining({ source: "/_next/static/:path*" }),
      ]),
    );

    const headers = Object.fromEntries(
      buildSecurityHeaders("production").map(({ key, value }) => [key.toLowerCase(), value]),
    );
    expect(headers["strict-transport-security"]).toBe("max-age=86400");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["content-security-policy"]).not.toContain("unsafe-eval");
  });

  it("canonicalizes the www hostname without changing paths", async () => {
    const redirects = await nextConfig.redirects?.();
    expect(redirects).toContainEqual({
      source: "/:path*",
      has: [{ type: "host", value: "www.navdhan.app" }],
      destination: "https://navdhan.app/:path*",
      permanent: true,
    });
  });

  it("permits only the webpack capabilities required by next dev", () => {
    const headers = Object.fromEntries(
      buildSecurityHeaders("development").map(({ key, value }) => [key.toLowerCase(), value]),
    );
    const csp = headers["content-security-policy"];

    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("ws:");
    expect(csp).toContain("wss:");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });
});
