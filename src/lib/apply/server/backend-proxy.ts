const APPLY_BACKEND_BASE_URL = "http://127.0.0.1:8000";
const SESSION_DIGEST_HEADER = "x-navdhan-session-digest";

interface ProxyRequestOptions {
  method: "GET" | "POST" | "PUT";
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

  return fetch(`${APPLY_BACKEND_BASE_URL}${path}`, init);
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
