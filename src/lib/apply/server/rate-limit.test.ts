import { beforeEach, describe, expect, it, vi } from "vitest";

const cloudflare = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn().mockImplementation(async () => ({ env: cloudflare.env })),
}));

import {
  enforceReadRateLimit,
  enforceSessionRateLimit,
  enforceUploadRateLimit,
  enforceWriteRateLimit,
} from "./rate-limit";

const ACTOR_IP = "203.0.113.24";

function request(withClientIp = true): Request {
  return new Request("https://navdhan.test/api/apply/session", {
    headers: withClientIp ? { "cf-connecting-ip": ACTOR_IP } : undefined,
  });
}

function configuredEnv(
  exactResult: unknown = { success: true, retry_after_seconds: 0 },
) {
  const nativeLimit = vi.fn().mockResolvedValue({ success: true });
  const exactFetch = vi.fn().mockResolvedValue(Response.json(exactResult));
  const objectId = { opaque: true };
  const idFromName = vi.fn().mockReturnValue(objectId);
  const get = vi.fn().mockReturnValue({ fetch: exactFetch });
  cloudflare.env = {
    APPLY_SESSION_RATE_LIMITER: { limit: nativeLimit },
    APPLY_WRITE_RATE_LIMITER: { limit: nativeLimit },
    APPLY_UPLOAD_RATE_LIMITER: { limit: nativeLimit },
    APPLY_READ_RATE_LIMITER: { limit: nativeLimit },
    APPLY_RATE_LIMITER_DO: { idFromName, get },
  };
  return { exactFetch, get, idFromName, nativeLimit, objectId };
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  cloudflare.env = {};
});

describe("two-layer apply rate limiting", () => {
  it("hashes the actor, checks the native layer, then checks the exact Durable Object", async () => {
    const mocks = configuredEnv();

    expect(await enforceSessionRateLimit(request())).toBeNull();

    const nativeKey = mocks.nativeLimit.mock.calls[0][0].key as string;
    expect(nativeKey).toMatch(/^[a-f0-9]{64}$/);
    expect(nativeKey).not.toContain(ACTOR_IP);
    expect(mocks.idFromName).toHaveBeenCalledWith(nativeKey);
    expect(mocks.get).toHaveBeenCalledWith(mocks.objectId);
    const exactRequest = mocks.exactFetch.mock.calls[0][0] as Request;
    expect(exactRequest.url).toBe("https://apply-rate-limiter.internal/limit");
    expect(await exactRequest.json()).toEqual({ limit: 10, period_seconds: 60 });
  });

  it("returns the Durable Object's bounded retry-after when the exact limit is full", async () => {
    configuredEnv({ success: false, retry_after_seconds: 17 });

    const response = await enforceUploadRateLimit(request());

    expect(response?.status).toBe(429);
    expect(response?.headers.get("retry-after")).toBe("17");
    expect(await response?.json()).toEqual({
      error: "RATE_LIMITED",
      retry_after_seconds: 17,
    });
  });

  it("keeps the native binding as the first coarse layer", async () => {
    const mocks = configuredEnv();
    mocks.nativeLimit.mockResolvedValue({ success: false });

    const response = await enforceSessionRateLimit(request());

    expect(response?.status).toBe(429);
    expect(response?.headers.get("retry-after")).toBe("60");
    expect(mocks.exactFetch).not.toHaveBeenCalled();
  });

  it("fails closed when either binding or its response is unavailable", async () => {
    configuredEnv();
    delete cloudflare.env.APPLY_RATE_LIMITER_DO;
    expect((await enforceSessionRateLimit(request()))?.status).toBe(503);

    const malformed = configuredEnv({ success: true, retry_after_seconds: 60 });
    expect((await enforceSessionRateLimit(request()))?.status).toBe(503);
    expect(malformed.exactFetch).toHaveBeenCalledOnce();

    cloudflare.env = {};
    expect((await enforceSessionRateLimit(request()))?.status).toBe(503);
    expect((await enforceSessionRateLimit(request(false)))?.status).toBe(503);
  });

  it("sends the configured policy for every rate class", async () => {
    const mocks = configuredEnv();
    const bodies: unknown[] = [];
    mocks.exactFetch.mockImplementation(async (exactRequest: Request) => {
      bodies.push(await exactRequest.json());
      return Response.json({ success: true, retry_after_seconds: 0 });
    });

    await enforceSessionRateLimit(request());
    await enforceWriteRateLimit(request());
    await enforceUploadRateLimit(request());
    await enforceReadRateLimit(request());

    expect(bodies).toEqual([
      { limit: 10, period_seconds: 60 },
      { limit: 120, period_seconds: 60 },
      { limit: 10, period_seconds: 60 },
      { limit: 300, period_seconds: 60 },
    ]);
    expect(new Set(mocks.idFromName.mock.calls.map(([key]) => key))).toHaveLength(4);
  });

  it("continues to bypass Cloudflare-only controls in local development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const mocks = configuredEnv();

    expect(await enforceSessionRateLimit(request(false))).toBeNull();
    expect(mocks.nativeLimit).not.toHaveBeenCalled();
    expect(mocks.exactFetch).not.toHaveBeenCalled();
  });
});
