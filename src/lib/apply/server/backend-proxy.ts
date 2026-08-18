const SESSION_DIGEST_HEADER = "x-navdhan-session-digest";

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
  const configured = process.env.APPLY_BACKEND_BASE_URL?.trim();
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
    console.error(
      `APPLY_BACKEND_BASE_URL must be an absolute URL including scheme, got "${configured}".`,
    );
    throw new Error("APPLY_BACKEND_BASE_URL is not a valid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    console.error(
      `APPLY_BACKEND_BASE_URL must use http or https, got "${parsed.protocol}".`,
    );
    throw new Error("APPLY_BACKEND_BASE_URL has an unsupported scheme");
  }

  // Trailing slashes would double up against the leading slash on every path.
  return configured.replace(/\/+$/, "");
}

interface ProxyRequestOptions {
  method: "GET" | "POST" | "PUT" | "DELETE";
  sessionDigest?: string;
  body?: unknown;
}

export async function requestApplyBackend(
  path: string,
  options: ProxyRequestOptions,
): Promise<Response> {
  const headers = new Headers();
  if (options.sessionDigest) {
    headers.set(SESSION_DIGEST_HEADER, options.sessionDigest);
  }

  const init: RequestInit = {
    method: options.method,
    headers,
    cache: "no-store",
  };
  if (options.body !== undefined) {
    headers.set("content-type", "application/json");
    init.body = JSON.stringify(options.body);
  }

  return fetch(`${applyBackendBaseUrl()}${path}`, init);
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
  const headers = new Headers();
  if (options.sessionDigest) {
    headers.set(SESSION_DIGEST_HEADER, options.sessionDigest);
  }

  return fetch(`${applyBackendBaseUrl()}${path}`, {
    method: options.method,
    headers,
    cache: "no-store",
    body: options.formData,
  });
}

export async function passBackendResponse(response: Response): Promise<Response> {
  if (response.status >= 500) {
    return Response.json(
      { error: "BACKEND_UNAVAILABLE" },
      { status: response.status },
    );
  }

  const contentType = response.headers.get("content-type")?.toLowerCase();
  if (!contentType?.includes("application/json")) {
    return Response.json({ error: "BACKEND_INVALID_RESPONSE" }, { status: 502 });
  }

  try {
    return Response.json(await response.json(), { status: response.status });
  } catch {
    return Response.json({ error: "BACKEND_INVALID_RESPONSE" }, { status: 502 });
  }
}

export function backendUnavailableResponse(): Response {
  return Response.json({ error: "BACKEND_UNAVAILABLE" }, { status: 502 });
}
