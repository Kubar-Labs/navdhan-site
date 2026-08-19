import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "crypto";

import { GET } from "./route";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/apply/applications/current", () => {
  it("rejects requests without a session cookie", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new Request("http://localhost/api/apply/applications/current"));

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("hashes the cookie into a server-only header and passes through the backend response", async () => {
    const browserCookieValue = "browser-only-cookie-value";
    const backendBody = {
      application_id: "application-1",
      current_step: "loan_intent",
      lock_version: 0,
    };
    const fetchMock = vi.fn().mockResolvedValue(Response.json(backendBody, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("http://localhost/api/apply/applications/current", {
        headers: { cookie: `another=value; __Host-nd_session=${browserCookieValue}` },
      }),
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:8000/api/apply/applications/current");
    expect(init.method).toBe("GET");
    expect(new Headers(init.headers).get("x-navdhan-session-digest")).toBe(
      createHash("sha256").update(browserCookieValue).digest("hex"),
    );
    expect(JSON.stringify(init)).not.toContain(browserCookieValue);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(backendBody);
  });

  it("preserves backend error status but drops raw detail", async () => {
    const backendBody = { detail: "Invalid or expired session" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json(backendBody, { status: 401 })),
    );

    const response = await GET(
      new Request("http://localhost/api/apply/applications/current", {
        headers: { cookie: "__Host-nd_session=expired-cookie-value" },
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      message: "Invalid or expired session",
    });
  });

  it("returns a generic gateway error when the backend cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("sensitive failure")));

    const response = await GET(
      new Request("http://localhost/api/apply/applications/current", {
        headers: { cookie: "__Host-nd_session=some-cookie-value" },
      }),
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "BACKEND_UNAVAILABLE" });
  });

  it("does not expose a non-JSON upstream body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("internal digest-like value abc123", {
          status: 200,
          headers: { "content-type": "text/plain" },
        }),
      ),
    );

    const response = await GET(
      new Request("http://localhost/api/apply/applications/current", {
        headers: { cookie: "__Host-nd_session=some-cookie-value" },
      }),
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "BACKEND_INVALID_RESPONSE" });
  });
});
