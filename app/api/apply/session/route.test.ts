import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "crypto";

import { POST } from "./route";

const CSRF_HEADERS = { "x-navdhan-requested-with": "apply" };

afterEach(() => {
  vi.unstubAllGlobals();
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
        headers: CSRF_HEADERS,
      }),
    );

    expect(response.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:8000/api/apply/session");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");

    const cookie = response.headers.get("set-cookie");
    expect(cookie).toContain("__Host-nd_session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=604800");

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
});
