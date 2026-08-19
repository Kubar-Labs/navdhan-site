import { afterEach, describe, expect, it, vi } from "vitest";

const cloudflareEnv = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env: cloudflareEnv.current }),
}));

import {
  backendUnavailableResponse,
  passBackendResponse,
  requestApplyBackend,
  requestApplyBackendForm,
} from "./backend-proxy";
import { jsonResponse, rateLimitedResponse } from "./errors";

const SERVICE_TOKEN = "test-service-token-at-least-32-bytes";

afterEach(() => {
  cloudflareEnv.current = {};
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("apply backend service boundary", () => {
  it("reads deployed secrets from the Cloudflare runtime context", async () => {
    vi.stubEnv("NODE_ENV", "production");
    cloudflareEnv.current = {
      APPLY_BACKEND_BASE_URL: "https://backend.example",
      APPLY_BACKEND_SERVICE_TOKEN: SERVICE_TOKEN,
    };
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await requestApplyBackend("/api/apply/session", { method: "POST" });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://backend.example/api/apply/session",
    );
    const headers = new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers);
    expect(headers.get("x-navdhan-service-token")).toBe(SERVICE_TOKEN);
  });

  it("sends the dedicated service token header on JSON requests", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APPLY_BACKEND_BASE_URL", "http://127.0.0.1:8000");
    vi.stubEnv("APPLY_BACKEND_SERVICE_TOKEN", SERVICE_TOKEN);
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await requestApplyBackend("/api/apply/session", {
      method: "POST",
      body: { token_digest: "a".repeat(64) },
    });

    const headers = new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers);
    expect(headers.get("x-navdhan-service-token")).toBe(SERVICE_TOKEN);
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).redirect).toBe("error");
  });

  it("sends the dedicated service token header on multipart requests", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APPLY_BACKEND_BASE_URL", "http://127.0.0.1:8000");
    vi.stubEnv("APPLY_BACKEND_SERVICE_TOKEN", SERVICE_TOKEN);
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await requestApplyBackendForm("/api/apply/applications/current/documents", {
      method: "POST",
      formData: new FormData(),
    });

    const headers = new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers);
    expect(headers.get("x-navdhan-service-token")).toBe(SERVICE_TOKEN);
  });

  it("uses a shorter timeout for JSON calls than for document uploads", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APPLY_BACKEND_BASE_URL", "http://127.0.0.1:8000");
    vi.stubEnv("APPLY_BACKEND_SERVICE_TOKEN", SERVICE_TOKEN);
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");

    await requestApplyBackend("/api/apply/session", { method: "POST" });
    await requestApplyBackendForm("/api/apply/applications/current/documents", {
      method: "POST",
      formData: new FormData(),
    });

    expect(timeoutSpy).toHaveBeenNthCalledWith(1, 30_000);
    expect(timeoutSpy).toHaveBeenNthCalledWith(2, 90_000);
    const jsonInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const formInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(jsonInit.signal).toBeInstanceOf(AbortSignal);
    expect(formInit.signal).toBeInstanceOf(AbortSignal);
    expect(jsonInit.signal).not.toBe(formInit.signal);
  });

  it("fails closed when the Worker service token is missing or weak", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APPLY_BACKEND_BASE_URL", "http://127.0.0.1:8000");
    vi.stubEnv("APPLY_BACKEND_SERVICE_TOKEN", "too-short");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestApplyBackend("/api/apply/session", { method: "POST" })).rejects.toThrow(
      "APPLY_BACKEND_SERVICE_TOKEN",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires HTTPS in production but permits loopback HTTP in development", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APPLY_BACKEND_BASE_URL", "http://backend.internal");
    vi.stubEnv("APPLY_BACKEND_SERVICE_TOKEN", SERVICE_TOKEN);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestApplyBackend("/api/apply/session", { method: "POST" })).rejects.toThrow(
      "must use HTTPS",
    );
    expect(fetchMock).not.toHaveBeenCalled();

    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APPLY_BACKEND_BASE_URL", "http://127.0.0.1:8000");
    fetchMock.mockResolvedValue(Response.json({ ok: true }));

    await expect(
      requestApplyBackend("/api/apply/session", { method: "POST" }),
    ).resolves.toBeInstanceOf(Response);
  });

  it("does not echo configured URLs or service tokens into logs", async () => {
    const configured = "not-a-url-containing-sensitive-material";
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APPLY_BACKEND_BASE_URL", configured);
    vi.stubEnv("APPLY_BACKEND_SERVICE_TOKEN", SERVICE_TOKEN);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(requestApplyBackend("/api/apply/session", { method: "POST" })).rejects.toThrow();

    const logs = JSON.stringify(error.mock.calls);
    expect(logs).not.toContain(configured);
    expect(logs).not.toContain(SERVICE_TOKEN);
  });
});

describe("apply backend error normalization", () => {
  it.each([
    ["a string detail", "a string detail"],
    [{ message: "a structured detail" }, "a structured detail"],
    [[{ msg: "first validation error" }, { msg: "second validation error" }],
      "first validation error; second validation error"],
  ])("exposes FastAPI detail safely as a client message", async (detail, message) => {
    const response = await passBackendResponse(
      Response.json(
        { detail, code: "VALIDATION_ERROR", debug: "must not cross the proxy" },
        { status: 422 },
      ),
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      message,
      code: "VALIDATION_ERROR",
    });
  });

  it("drops arbitrary error fields and only preserves conventionally safe codes", async () => {
    const response = await passBackendResponse(
      Response.json(
        {
          message: `  ${"x".repeat(600)}  `,
          detail: { input: "sensitive value" },
          code: "unsafe code and diagnostics",
          error: "STALE_WRITE",
          current_lock_version: 7,
        },
        { status: 409 },
      ),
    );

    await expect(response.json()).resolves.toEqual({
      message: "x".repeat(500),
      error: "STALE_WRITE",
    });
  });

  it("continues to redact backend 5xx bodies", async () => {
    const response = await passBackendResponse(
      Response.json({ detail: "sensitive internal failure" }, { status: 500 }),
    );

    await expect(response.json()).resolves.toEqual({ error: "BACKEND_UNAVAILABLE" });
  });
});

describe("apply response cache policy", () => {
  it("marks proxy and locally generated JSON responses as non-cacheable", async () => {
    const responses = [
      await passBackendResponse(Response.json({ ok: true })),
      await passBackendResponse(new Response("not json")),
      backendUnavailableResponse(),
      jsonResponse({ error: "LOCAL_ERROR" }, 400),
      rateLimitedResponse(30),
    ];

    for (const response of responses) {
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("pragma")).toBe("no-cache");
    }
    expect(responses.at(-1)?.headers.get("retry-after")).toBe("30");
  });
});
