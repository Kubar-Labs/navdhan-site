import { getCloudflareContext } from "@opennextjs/cloudflare";
import { jsonResponse, rateLimitedResponse } from "./errors";

interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface NavDhanCloudflareEnv extends CloudflareEnv {
  APPLY_SESSION_RATE_LIMITER?: RateLimitBinding;
  APPLY_WRITE_RATE_LIMITER?: RateLimitBinding;
  APPLY_UPLOAD_RATE_LIMITER?: RateLimitBinding;
  APPLY_READ_RATE_LIMITER?: RateLimitBinding;
}

type RateLimitBindingName =
  | "APPLY_SESSION_RATE_LIMITER"
  | "APPLY_WRITE_RATE_LIMITER"
  | "APPLY_UPLOAD_RATE_LIMITER"
  | "APPLY_READ_RATE_LIMITER";

function unavailableResponse(): Response {
  return jsonResponse({ error: "RATE_LIMIT_UNAVAILABLE" }, 503);
}

async function enforceRateLimit(
  request: Request,
  bindingName: RateLimitBindingName,
): Promise<Response | null> {
  // `next dev` and unit tests do not run at the Cloudflare edge. Production
  // and preview deployments do, and must never silently bypass the binding.
  if (process.env.NODE_ENV !== "production") return null;

  const clientIp = request.headers.get("cf-connecting-ip")?.trim();
  if (!clientIp || clientIp.length > 64) {
    console.error(`Missing trusted Cloudflare client IP for ${bindingName}.`);
    return unavailableResponse();
  }

  try {
    const { env } = await getCloudflareContext({ async: true });
    const binding = (env as NavDhanCloudflareEnv)[bindingName];
    if (!binding) {
      console.error(`Required Cloudflare rate-limit binding ${bindingName} is missing.`);
      return unavailableResponse();
    }

    const result = await binding.limit({ key: clientIp });
    return result.success ? null : rateLimitedResponse(60);
  } catch {
    console.error(`Cloudflare rate-limit check failed for ${bindingName}.`);
    return unavailableResponse();
  }
}

export function enforceSessionRateLimit(request: Request): Promise<Response | null> {
  return enforceRateLimit(request, "APPLY_SESSION_RATE_LIMITER");
}

export function enforceWriteRateLimit(request: Request): Promise<Response | null> {
  return enforceRateLimit(request, "APPLY_WRITE_RATE_LIMITER");
}

export function enforceUploadRateLimit(request: Request): Promise<Response | null> {
  return enforceRateLimit(request, "APPLY_UPLOAD_RATE_LIMITER");
}

export function enforceReadRateLimit(request: Request): Promise<Response | null> {
  return enforceRateLimit(request, "APPLY_READ_RATE_LIMITER");
}
