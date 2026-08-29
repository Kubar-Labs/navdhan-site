import { getCloudflareContext } from "@opennextjs/cloudflare";
import { jsonResponse, rateLimitedResponse } from "./errors";

interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface ExactRateLimitStub {
  fetch(request: Request): Promise<Response>;
}

interface ExactRateLimitNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): ExactRateLimitStub;
}

interface NavDhanCloudflareEnv extends CloudflareEnv {
  APPLY_SESSION_RATE_LIMITER?: RateLimitBinding;
  APPLY_WRITE_RATE_LIMITER?: RateLimitBinding;
  APPLY_UPLOAD_RATE_LIMITER?: RateLimitBinding;
  APPLY_READ_RATE_LIMITER?: RateLimitBinding;
  APPLY_RATE_LIMITER_DO?: ExactRateLimitNamespace;
}

type RateLimitBindingName =
  | "APPLY_SESSION_RATE_LIMITER"
  | "APPLY_WRITE_RATE_LIMITER"
  | "APPLY_UPLOAD_RATE_LIMITER"
  | "APPLY_READ_RATE_LIMITER";

interface RateLimitPolicy {
  bindingName: RateLimitBindingName;
  limit: number;
  periodSeconds: 60;
}

const RATE_LIMIT_POLICIES = {
  session: {
    bindingName: "APPLY_SESSION_RATE_LIMITER",
    limit: 10,
    periodSeconds: 60,
  },
  write: {
    bindingName: "APPLY_WRITE_RATE_LIMITER",
    limit: 120,
    periodSeconds: 60,
  },
  upload: {
    bindingName: "APPLY_UPLOAD_RATE_LIMITER",
    limit: 10,
    periodSeconds: 60,
  },
  read: {
    bindingName: "APPLY_READ_RATE_LIMITER",
    limit: 300,
    periodSeconds: 60,
  },
} as const satisfies Record<string, RateLimitPolicy>;

type RateLimitClass = keyof typeof RATE_LIMIT_POLICIES;

interface ExactRateLimitResult {
  success: boolean;
  retry_after_seconds: number;
}

function unavailableResponse(): Response {
  return jsonResponse({ error: "RATE_LIMIT_UNAVAILABLE" }, 503);
}

async function privateActorKey(rateClass: RateLimitClass, clientIp: string): Promise<string> {
  const input = new TextEncoder().encode(`${rateClass}\0${clientIp}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isExactRateLimitResult(
  value: unknown,
  periodSeconds: number,
): value is ExactRateLimitResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.success === "boolean" &&
    Number.isInteger(candidate.retry_after_seconds) &&
    Number(candidate.retry_after_seconds) >= 0 &&
    Number(candidate.retry_after_seconds) <= periodSeconds &&
    (candidate.success === true
      ? candidate.retry_after_seconds === 0
      : Number(candidate.retry_after_seconds) >= 1)
  );
}

async function enforceRateLimit(
  request: Request,
  rateClass: RateLimitClass,
): Promise<Response | null> {
  // `next dev` and unit tests do not run at the Cloudflare edge. Production
  // and preview deployments do, and must never silently bypass the binding.
  if (process.env.NODE_ENV !== "production") return null;

  const policy = RATE_LIMIT_POLICIES[rateClass];
  const clientIp = request.headers.get("cf-connecting-ip")?.trim();
  if (!clientIp || clientIp.length > 64) {
    console.error(`Missing trusted Cloudflare client IP for ${policy.bindingName}.`);
    return unavailableResponse();
  }

  try {
    const { env } = await getCloudflareContext({ async: true });
    const cloudflareEnv = env as NavDhanCloudflareEnv;
    const binding = cloudflareEnv[policy.bindingName];
    if (!binding) {
      console.error(`Required Cloudflare rate-limit binding ${policy.bindingName} is missing.`);
      return unavailableResponse();
    }

    // The native binding is a fast coarse layer, but Cloudflare documents it
    // as permissive and eventually consistent. Hash the actor before it enters
    // either counter, then require the Durable Object for exact enforcement.
    const actorKey = await privateActorKey(rateClass, clientIp);
    const coarseResult = await binding.limit({ key: actorKey });
    if (!coarseResult.success) {
      return rateLimitedResponse(policy.periodSeconds);
    }

    const exactNamespace = cloudflareEnv.APPLY_RATE_LIMITER_DO;
    if (!exactNamespace) {
      console.error("Required Cloudflare Durable Object binding APPLY_RATE_LIMITER_DO is missing.");
      return unavailableResponse();
    }
    const objectId = exactNamespace.idFromName(actorKey);
    const exactResponse = await exactNamespace.get(objectId).fetch(
      new Request("https://apply-rate-limiter.internal/limit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          limit: policy.limit,
          period_seconds: policy.periodSeconds,
        }),
      }),
    );
    if (!exactResponse.ok) {
      throw new Error("Exact rate limiter returned a non-success response");
    }
    const exactResult: unknown = await exactResponse.json();
    if (!isExactRateLimitResult(exactResult, policy.periodSeconds)) {
      throw new Error("Exact rate limiter returned an invalid response");
    }
    return exactResult.success
      ? null
      : rateLimitedResponse(exactResult.retry_after_seconds);
  } catch {
    console.error(`Cloudflare rate-limit check failed for ${policy.bindingName}.`);
    return unavailableResponse();
  }
}

export function enforceSessionRateLimit(request: Request): Promise<Response | null> {
  return enforceRateLimit(request, "session");
}

export function enforceWriteRateLimit(request: Request): Promise<Response | null> {
  return enforceRateLimit(request, "write");
}

export function enforceUploadRateLimit(request: Request): Promise<Response | null> {
  return enforceRateLimit(request, "upload");
}

export function enforceReadRateLimit(request: Request): Promise<Response | null> {
  return enforceRateLimit(request, "read");
}
