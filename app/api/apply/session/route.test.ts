import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "crypto";

const sessionRateLimitMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ success: true }),
);
const exactRateLimitMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue(
    Response.json({ success: true, retry_after_seconds: 0 }),
  ),
);

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn().mockResolvedValue({
    env: {
      APPLY_SESSION_RATE_LIMITER: { limit: sessionRateLimitMock },
      APPLY_RATE_LIMITER_DO: {
        idFromName: vi.fn().mockReturnValue("synthetic-object-id"),
        get: vi.fn().mockReturnValue({ fetch: exactRateLimitMock }),
      },
    },
  }),
}));

import { POST } from "./route";

const CSRF_HEADERS = { "x-navdhan-requested-with": "apply" };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("POST /api/apply/session", () => {
  it("requires the apply CSRF header before contacting the backend", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(new Request("http://localhost/api/apply/session", { method: "POST" }));

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not set a cookie when the backend rejects session creation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ detail: "Unavailable" }, { status: 503 })),
    );

    const response = await POST(
      new Request("http://localhost/api/apply/session", {
        method: "POST",
        headers: CSRF_HEADERS,
      }),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.json()).toEqual({ error: "BACKEND_UNAVAILABLE" });
  });

  it("does not expose a digest echoed in a non-JSON backend response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body)) as { token_digest: string };
        return Promise.resolve(
          new Response(`debug ${body.token_digest}`, {
            status: 201,
            headers: { "content-type": "text/plain" },
          }),
        );
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/apply/session", {
        method: "POST",
        headers: CSRF_HEADERS,
      }),
    );

    expect(response.status).toBe(502);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.json()).toEqual({ error: "BACKEND_INVALID_RESPONSE" });
  });

  it("stores a random browser token while sending only its digest to the backend", async () => {
    // __Host- + Secure is the production cookie contract (see
    // src/lib/apply/server/session.ts) — it requires HTTPS, so pin
    // NODE_ENV here rather than relying on vitest's ambient env.
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APPLY_BACKEND_BASE_URL", "https://backend.example");
    const fetchMock = vi.fn().mockImplementation((_: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { token_digest: string };
      return Promise.resolve(
        Response.json(
          { created: true, token_digest: body.token_digest },
          { status: 201 },
        ),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://localhost/api/apply/session", {
        method: "POST",
        headers: { ...CSRF_HEADERS, "cf-connecting-ip": "203.0.113.10" },
      }),
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
    const rateLimitKey = sessionRateLimitMock.mock.calls[0][0].key as string;
    expect(rateLimitKey).toMatch(/^[a-f0-9]{64}$/);
    expect(rateLimitKey).not.toContain("203.0.113.10");
    expect(exactRateLimitMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://backend.example/api/apply/session");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");

    const cookies = response.headers.getSetCookie();
    expect(cookies).toHaveLength(2);
    const cookie = cookies.find((value) =>
      value.startsWith("__Host-nd_session="),
    );
    const expiredDevCookie = cookies.find((value) =>
      value.startsWith("nd_session="),
    );
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=604800");
    expect(expiredDevCookie).toContain("Max-Age=0");

    const token = cookie?.match(/__Host-nd_session=([^;]+)/)?.[1];
    expect(token).toBeTruthy();
    expect(Buffer.from(token!, "base64url")).toHaveLength(32);

    const backendBody = JSON.parse(String(init.body)) as { token_digest: string };
    expect(backendBody.token_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(backendBody.token_digest).toBe(
      createHash("sha256").update(token!).digest("hex"),
    );
    expect(String(init.body)).not.toContain(token!);

    const responseText = await response.text();
    expect(responseText).not.toContain(token!);
    expect(responseText).not.toContain(backendBody.token_digest);
    expect(JSON.parse(responseText)).toEqual({ created: true });
  });

  it("drops __Host-/Secure in development so the session cookie actually persists over http://localhost", async () => {
    // Regression: a Secure cookie set over plain http (as `next dev` serves
    // by default) is silently dropped by the browser — every request after
    // session creation then comes back unauthenticated. See
    // src/lib/apply/server/session.ts.
    vi.stubEnv("NODE_ENV", "development");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body)) as { token_digest: string };
        return Promise.resolve(
          Response.json({ created: true, token_digest: body.token_digest }, { status: 201 }),
        );
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/apply/session", {
        method: "POST",
        headers: CSRF_HEADERS,
      }),
    );

    const cookies = response.headers.getSetCookie();
    expect(cookies).toHaveLength(2);
    const cookie = cookies.find((value) => value.startsWith("nd_session="));
    const expiredProductionCookie = cookies.find((value) =>
      value.startsWith("__Host-nd_session="),
    );
    expect(cookie).not.toContain("__Host-");
    expect(cookie).not.toContain("Secure");
    expect(cookie).toContain("HttpOnly");
    expect(expiredProductionCookie).toContain("Secure");
    expect(expiredProductionCookie).toContain("Max-Age=0");
  });
});
