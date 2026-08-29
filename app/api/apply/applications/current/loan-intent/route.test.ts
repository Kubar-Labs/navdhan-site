import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "crypto";

import { PUT } from "./route";

const BROWSER_COOKIE_VALUE = "browser-only-cookie-value";
const REQUEST_HEADERS = {
  "content-type": "application/json",
  cookie: `__Host-nd_session=${BROWSER_COOKIE_VALUE}`,
  "x-navdhan-requested-with": "apply",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function request(body: unknown, headers: Record<string, string> = REQUEST_HEADERS): Request {
  return new Request("http://localhost/api/apply/applications/current/loan-intent", {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
}

describe("PUT /api/apply/applications/current/loan-intent", () => {
  it("requires CSRF and a session before contacting the backend", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const validBody = {
      constitution: "proprietorship",
      requested_amount: 500_000,
      requested_tenure_months: 6,
      purpose: "working_capital",
      expected_lock_version: 0,
    };

    const csrfResponse = await PUT(
      request(validBody, { cookie: `__Host-nd_session=${BROWSER_COOKIE_VALUE}` }),
    );
    const sessionResponse = await PUT(
      request(validBody, {
        "content-type": "application/json",
        "x-navdhan-requested-with": "apply",
      }),
    );

    expect(csrfResponse.status).toBe(403);
    expect(sessionResponse.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates and forwards the canonical loan intent with only a session digest", async () => {
    const backendBody = {
      application_id: "application-1",
      current_step: "business_profile",
      lock_version: 3,
    };
    const fetchMock = vi.fn().mockResolvedValue(Response.json(backendBody, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const body = {
      constitution: "partnership",
      requested_amount: 750_000,
      requested_tenure_months: 9,
      purpose: "machinery",
      referral_code: "PARTNER_1",
      expected_lock_version: 2,
      ignored: "not-forwarded",
    };

    const response = await PUT(request(body));

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:8000/api/apply/applications/current/loan-intent");
    expect(init.method).toBe("PUT");
    const headers = new Headers(init.headers);
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("x-navdhan-session-digest")).toBe(
      createHash("sha256").update(BROWSER_COOKIE_VALUE).digest("hex"),
    );
    expect(JSON.stringify(init)).not.toContain(BROWSER_COOKIE_VALUE);
    expect(JSON.parse(String(init.body))).toEqual({
      constitution: "partnership",
      requested_amount: 750_000,
      requested_tenure_months: 9,
      purpose: "machinery",
      referral_code: "PARTNER_1",
      expected_lock_version: 2,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(backendBody);
  });

  it("normalizes the existing UI amount and tenure aliases when used cleanly", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ saved: true }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await PUT(
      request({
        constitution: "private_limited",
        loan_amount: 1_000_000,
        tenure_months: 12,
        purpose: "business_expansion",
        expected_lock_version: 0,
      }),
    );

    expect(response.status).toBe(200);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      constitution: "private_limited",
      requested_amount: 1_000_000,
      requested_tenure_months: 12,
      purpose: "business_expansion",
      expected_lock_version: 0,
    });
  });

  it("omits an empty optional referral code", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ saved: true }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await PUT(
      request({
        constitution: "proprietorship",
        requested_amount: 500_000,
        requested_tenure_months: 6,
        purpose: "inventory",
        referral_code: "",
        expected_lock_version: 3,
      }),
    );

    expect(response.status).toBe(200);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      constitution: "proprietorship",
      requested_amount: 500_000,
      requested_tenure_months: 6,
      purpose: "inventory",
      expected_lock_version: 3,
    });
  });

  it.each([
    [{ requested_amount: 500_000, requested_tenure_months: 6, purpose: "working_capital", expected_lock_version: 0 }],
    [{ constitution: "llp", requested_amount: 500_000, requested_tenure_months: 6, purpose: "working_capital", expected_lock_version: 0 }],
    [{ constitution: "proprietorship", requested_amount: 500_001, requested_tenure_months: 6, purpose: "working_capital", expected_lock_version: 0 }],
    [{ constitution: "proprietorship", requested_amount: 500_000, requested_tenure_months: 24, purpose: "working_capital", expected_lock_version: 0 }],
    [{ constitution: "proprietorship", requested_amount: 500_000, loan_amount: 500_000, requested_tenure_months: 6, purpose: "working_capital", expected_lock_version: 0 }],
    [{ constitution: "proprietorship", requested_amount: 500_000, requested_tenure_months: 6, purpose: "working_capital" }],
    [{ constitution: "proprietorship", requested_amount: 500_000, requested_tenure_months: 6, purpose: "working_capital", expected_lock_version: -1 }],
    [{ constitution: "proprietorship", requested_amount: 500_000, requested_tenure_months: 6, purpose: "working_capital", expected_lock_version: 1.5 }],
  ])("rejects invalid or ambiguous payloads before proxying (%o)", async (body) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await PUT(request(body));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("VALIDATION_ERROR");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves backend validation status but drops raw validation detail", async () => {
    const backendBody = { detail: [{ loc: ["body", "constitution"], msg: "invalid" }] };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json(backendBody, { status: 422 })),
    );

    const response = await PUT(
      request({
        constitution: "proprietorship",
        requested_amount: 500_000,
        requested_tenure_months: 6,
        purpose: "other",
        expected_lock_version: 0,
      }),
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ message: "invalid" });
  });

  it("rejects malformed JSON before proxying", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const malformedRequest = new Request(
      "http://localhost/api/apply/applications/current/loan-intent",
      {
        method: "PUT",
        headers: REQUEST_HEADERS,
        body: "{",
      },
    );

    const response = await PUT(malformedRequest);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "BAD_REQUEST",
      message: "Invalid JSON body",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves a stale-write message without exposing backend metadata", async () => {
    const backendBody = {
      detail: {
        message: "Application was updated; refresh and retry",
        current_lock_version: 4,
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json(backendBody, { status: 409 })),
    );

    const response = await PUT(
      request({
        constitution: "proprietorship",
        requested_amount: 500_000,
        requested_tenure_months: 6,
        purpose: "working_capital",
        expected_lock_version: 3,
      }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      message: "Application was updated; refresh and retry",
    });
  });

  it("does not expose a backend 5xx body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          { detail: "internal database failure with digest-like value abc123" },
          { status: 503 },
        ),
      ),
    );

    const response = await PUT(
      request({
        constitution: "proprietorship",
        requested_amount: 500_000,
        requested_tenure_months: 6,
        purpose: "working_capital",
        expected_lock_version: 0,
      }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "BACKEND_UNAVAILABLE" });
  });

  it("rejects a declared oversized body before reading or proxying it", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const oversizedRequest = new Request(
      "http://localhost/api/apply/applications/current/loan-intent",
      {
        method: "PUT",
        headers: {
          ...REQUEST_HEADERS,
          "content-length": "20000",
        },
        body: "{}",
      },
    );

    const response = await PUT(oversizedRequest);

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "PAYLOAD_TOO_LARGE" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bounds the actual body when content length is absent", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const oversizedRequest = request({ padding: "x".repeat(20_000) });

    const response = await PUT(oversizedRequest);

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "PAYLOAD_TOO_LARGE" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
