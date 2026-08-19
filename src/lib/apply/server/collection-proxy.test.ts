import { createHash } from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isSafePartyId,
  proxyCollectionWrite,
  type CollectionPayloadValidator,
} from "./collection-proxy";

const BROWSER_COOKIE_VALUE = "synthetic-browser-cookie-value";
const VALID_HEADERS = {
  "content-type": "application/json",
  cookie: `__Host-nd_session=${BROWSER_COOKIE_VALUE}`,
  "x-navdhan-requested-with": "apply",
};
const validator: CollectionPayloadValidator<{ expected_lock_version: number }> = (input) => {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    !Number.isInteger((input as Record<string, unknown>).expected_lock_version)
  ) {
    return {
      errors: [
        { field: "expected_lock_version", message_i18n_key: "apply.errors.invalidLockVersion" },
      ],
    };
  }
  return {
    value: {
      expected_lock_version: (input as Record<string, number>).expected_lock_version,
    },
    errors: [],
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function request(body: BodyInit, headers: Record<string, string> = VALID_HEADERS): Request {
  return new Request("http://localhost/api/apply/applications/current/example", {
    method: "PUT",
    headers,
    body,
  });
}

describe("Phase 3 collection proxy boundary", () => {
  it("requires CSRF and a browser session before contacting the backend", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const csrfResponse = await proxyCollectionWrite(
      request(JSON.stringify({ expected_lock_version: 0 }), {
        cookie: `__Host-nd_session=${BROWSER_COOKIE_VALUE}`,
      }),
      "/api/apply/applications/current/example",
      validator,
    );
    const sessionResponse = await proxyCollectionWrite(
      request(JSON.stringify({ expected_lock_version: 0 }), {
        "x-navdhan-requested-with": "apply",
      }),
      "/api/apply/applications/current/example",
      validator,
    );

    expect(csrfResponse.status).toBe(403);
    expect(sessionResponse.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards only validated JSON and a one-way session digest", async () => {
    const backendBody = { application_id: "application-1", lock_version: 2 };
    const fetchMock = vi.fn().mockResolvedValue(Response.json(backendBody));
    vi.stubGlobal("fetch", fetchMock);

    const response = await proxyCollectionWrite(
      request(JSON.stringify({ expected_lock_version: 1, ignored: "drop-me" })),
      "/api/apply/applications/current/example",
      validator,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(backendBody);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:8000/api/apply/applications/current/example");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({ expected_lock_version: 1 });
    const headers = new Headers(init.headers);
    expect(headers.get("x-navdhan-session-digest")).toBe(
      createHash("sha256").update(BROWSER_COOKIE_VALUE).digest("hex"),
    );
    expect(JSON.stringify(init)).not.toContain(BROWSER_COOKIE_VALUE);
  });

  it("supports POST collection writes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ lock_version: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await proxyCollectionWrite(
      request(JSON.stringify({ expected_lock_version: 0 })),
      "/api/apply/applications/current/parties",
      validator,
      "POST",
    );

    expect(response.status).toBe(200);
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe("POST");
  });

  it("rejects malformed, invalid, and oversized bodies without proxying", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const malformed = await proxyCollectionWrite(
      request("{"),
      "/api/apply/applications/current/example",
      validator,
    );
    const invalid = await proxyCollectionWrite(
      request(JSON.stringify({ expected_lock_version: -1 })),
      "/api/apply/applications/current/example",
      (input) => ({
        errors: [{ field: "body", message_i18n_key: "apply.errors.invalidRequest" }],
      }),
    );
    const declaredOversized = await proxyCollectionWrite(
      request("{}", { ...VALID_HEADERS, "content-length": "20000" }),
      "/api/apply/applications/current/example",
      validator,
    );
    const actualOversized = await proxyCollectionWrite(
      request(JSON.stringify({ padding: "x".repeat(20_000) })),
      "/api/apply/applications/current/example",
      validator,
    );

    expect(malformed.status).toBe(400);
    expect(invalid.status).toBe(400);
    expect(declaredOversized.status).toBe(413);
    expect(actualOversized.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves safe backend errors but sanitizes backend failures", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ detail: "stale", current_lock_version: 2 }, { status: 409 }),
      )
      .mockResolvedValueOnce(
        Response.json({ detail: "database diagnostics and PII" }, { status: 503 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const stale = await proxyCollectionWrite(
      request(JSON.stringify({ expected_lock_version: 1 })),
      "/api/apply/applications/current/example",
      validator,
    );
    const unavailable = await proxyCollectionWrite(
      request(JSON.stringify({ expected_lock_version: 1 })),
      "/api/apply/applications/current/example",
      validator,
    );

    expect(stale.status).toBe(409);
    expect(await stale.json()).toEqual({ detail: "stale", current_lock_version: 2 });
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toEqual({ error: "BACKEND_UNAVAILABLE" });
  });

  it("uses a strict UUID allowlist for dynamic party paths", () => {
    expect(isSafePartyId("10000000-0000-4000-8000-000000000001")).toBe(true);
    expect(isSafePartyId("../gst-registration")).toBe(false);
    expect(isSafePartyId("not-a-uuid")).toBe(false);
  });
});
