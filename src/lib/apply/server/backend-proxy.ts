import { getCloudflareContext } from "@opennextjs/cloudflare";

import { jsonResponse } from "./errors";

const SESSION_DIGEST_HEADER = "x-navdhan-session-digest";
const SERVICE_TOKEN_HEADER = "x-navdhan-service-token";
const MIN_SERVICE_TOKEN_BYTES = 32;
const JSON_BACKEND_TIMEOUT_MS = 30_000;
const FORM_BACKEND_TIMEOUT_MS = 90_000;

type ApplyBackendBinding =
  | "APPLY_BACKEND_BASE_URL"
  | "APPLY_BACKEND_SERVICE_TOKEN";

function runtimeBinding(name: ApplyBackendBinding): string | undefined {
  try {
    const env = getCloudflareContext().env as unknown as Record<string, unknown>;
    const value = env[name];
    if (typeof value === "string") return value;
  } catch {
    // Local Node processes and unit tests have no Cloudflare request context.
  }
  return process.env[name];
}

/**
 * Base URL of the collection backend: the local uvicorn process in development,
 * the Cloud Run URL in a deployed environment.
 *
 * There is no built-in default by design. A fallback to loopback would let a
 * deployed Worker fetch itself instead of the backend, which fails as an opaque
 * timeout rather than a configuration error.
 *
 * Resolved per call rather than captured at module load: a Worker isolate
 * evaluates the module graph once and then reuses it across many requests, so
 * an import-time read would pin whatever the environment looked like when the
 * isolate started.
 */
function applyBackendBaseUrl(): string {
  const configured = runtimeBinding("APPLY_BACKEND_BASE_URL")?.trim();
  if (!configured) {
    // Route handlers turn any throw from here into BACKEND_UNAVAILABLE, so log
    // the real cause first or a missing variable looks like a backend outage.
    console.error(
      "APPLY_BACKEND_BASE_URL is not set. Set it in .env.local for local " +
        "development, or as a Worker variable for a deployed environment.",
    );
    throw new Error("APPLY_BACKEND_BASE_URL is not set");
  }

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    console.error("APPLY_BACKEND_BASE_URL must be an absolute URL including scheme.");
    throw new Error("APPLY_BACKEND_BASE_URL is not a valid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    console.error("APPLY_BACKEND_BASE_URL must use http or https.");
    throw new Error("APPLY_BACKEND_BASE_URL has an unsupported scheme");
  }
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    console.error("APPLY_BACKEND_BASE_URL must use HTTPS in production.");
    throw new Error("APPLY_BACKEND_BASE_URL must use HTTPS in production");
  }

  // Trailing slashes would double up against the leading slash on every path.
  return configured.replace(/\/+$/, "");
}

function applyBackendServiceToken(): string {
  const token = runtimeBinding("APPLY_BACKEND_SERVICE_TOKEN");
  if (!token || new TextEncoder().encode(token).byteLength < MIN_SERVICE_TOKEN_BYTES) {
    console.error(
      `APPLY_BACKEND_SERVICE_TOKEN must be configured with at least ${MIN_SERVICE_TOKEN_BYTES} bytes.`,
    );
    throw new Error("APPLY_BACKEND_SERVICE_TOKEN is missing or too short");
  }
  return token;
}

function applyBackendHeaders(sessionDigest?: string): Headers {
  const headers = new Headers({
    [SERVICE_TOKEN_HEADER]: applyBackendServiceToken(),
  });
  if (sessionDigest) {
    headers.set(SESSION_DIGEST_HEADER, sessionDigest);
  }
  return headers;
}

interface ProxyRequestOptions {
  method: "GET" | "POST" | "PUT" | "DELETE";
  sessionDigest?: string;
  body?: unknown;
}

async function fetchApplyBackend(url: string, init: RequestInit): Promise<Response> {
  // Cloudflare Workers does not implement redirect: "error". Manual mode keeps
  // the service token on the configured origin; explicitly reject every 3xx so
  // callers cannot accidentally accept or follow a backend redirect.
  const response = await fetch(url, { ...init, redirect: "manual" });
  if (response.status >= 300 && response.status < 400) {
    console.error("The apply backend returned a redirect, which is not allowed.");
    throw new Error("Apply backend redirects are not allowed");
  }
  return response;
}

export async function requestApplyBackend(
  path: string,
  options: ProxyRequestOptions,
): Promise<Response> {
  const headers = applyBackendHeaders(options.sessionDigest);

  const init: RequestInit = {
    method: options.method,
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(JSON_BACKEND_TIMEOUT_MS),
  };
  if (options.body !== undefined) {
    headers.set("content-type", "application/json");
    init.body = JSON.stringify(options.body);
  }

  return fetchApplyBackend(`${applyBackendBaseUrl()}${path}`, init);
}

interface ProxyFormRequestOptions {
  method: "POST";
  sessionDigest?: string;
  formData: FormData;
}

export async function requestApplyBackendForm(
  path: string,
  options: ProxyFormRequestOptions,
): Promise<Response> {
  const headers = applyBackendHeaders(options.sessionDigest);

  return fetchApplyBackend(`${applyBackendBaseUrl()}${path}`, {
    method: options.method,
    headers,
    cache: "no-store",
    body: options.formData,
    signal: AbortSignal.timeout(FORM_BACKEND_TIMEOUT_MS),
  });
}

const MAX_BACKEND_ERROR_MESSAGE_LENGTH = 500;
const SAFE_BACKEND_CODE_RE = /^[A-Z][A-Z0-9_]{0,63}$/;

function boundedBackendMessage(message: string): string | undefined {
  const normalized = message.trim().replace(/\s+/g, " ");
  if (!normalized) return undefined;
  return normalized.slice(0, MAX_BACKEND_ERROR_MESSAGE_LENGTH);
}

function backendDetailMessage(detail: unknown): string | undefined {
  let message: string | undefined;

  if (typeof detail === "string") {
    message = detail;
  } else if (Array.isArray(detail)) {
    const messages = detail
      .map((entry) => {
        if (!entry || typeof entry !== "object") return undefined;
        const candidate = (entry as Record<string, unknown>).msg;
        return typeof candidate === "string" ? candidate : undefined;
      })
      .filter((candidate): candidate is string => Boolean(candidate));
    message = messages.join("; ");
  } else if (detail && typeof detail === "object") {
    const candidate = (detail as Record<string, unknown>).message;
    if (typeof candidate === "string") message = candidate;
  }

  return message === undefined ? undefined : boundedBackendMessage(message);
}

function normalizeBackendPayload(payload: unknown, status: number): unknown {
  if (status < 400) return payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};

  const body = payload as Record<string, unknown>;
  const directMessage =
    typeof body.message === "string" ? boundedBackendMessage(body.message) : undefined;
  const message = directMessage ?? backendDetailMessage(body.detail);
  const code =
    typeof body.code === "string" && SAFE_BACKEND_CODE_RE.test(body.code)
      ? body.code
      : undefined;
  const error =
    typeof body.error === "string" && SAFE_BACKEND_CODE_RE.test(body.error)
      ? body.error
      : undefined;

  return {
    ...(message ? { message } : {}),
    ...(code ? { code } : {}),
    ...(error ? { error } : {}),
  };
}

export async function passBackendResponse(response: Response): Promise<Response> {
  if (response.status >= 500) {
    return jsonResponse({ error: "BACKEND_UNAVAILABLE" }, response.status);
  }

  const contentType = response.headers.get("content-type")?.toLowerCase();
  if (!contentType?.includes("application/json")) {
    return jsonResponse({ error: "BACKEND_INVALID_RESPONSE" }, 502);
  }

  try {
    const payload = await response.json();
    return jsonResponse(normalizeBackendPayload(payload, response.status), response.status);
  } catch {
    return jsonResponse({ error: "BACKEND_INVALID_RESPONSE" }, 502);
  }
}

export function backendUnavailableResponse(): Response {
  return jsonResponse({ error: "BACKEND_UNAVAILABLE" }, 502);
}
