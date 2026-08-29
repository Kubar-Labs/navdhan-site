import { consumeFixedWindow, type FixedWindowState } from "./rate-limit-window";

interface LimitRequest {
  limit: number;
  period_seconds: number;
}

interface BucketRow {
  window_id: number;
  request_count: number;
}

interface SqlResult<T> {
  toArray(): T[];
}

interface DurableObjectStorage {
  sql: {
    exec<T = Record<string, unknown>>(query: string, ...bindings: unknown[]): SqlResult<T>;
  };
}

interface DurableObjectContext {
  storage: DurableObjectStorage;
}

function isLimitRequest(value: unknown): value is LimitRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    Number.isInteger(candidate.limit) &&
    Number(candidate.limit) >= 1 &&
    Number(candidate.limit) <= 10_000 &&
    (candidate.period_seconds === 10 || candidate.period_seconds === 60)
  );
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

/**
 * Exact per-actor fixed-window limiter. Each actor/rate-class pair maps to a
 * separate object ID, so storage contains only a counter and window number —
 * never an IP address or other user identifier.
 */
export class ApplyRateLimiter {
  private readonly storage: DurableObjectStorage;

  constructor(ctx: DurableObjectContext) {
    this.storage = ctx.storage;
    this.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS rate_limit_bucket (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
        window_id INTEGER NOT NULL,
        request_count INTEGER NOT NULL CHECK (request_count >= 0)
      )
    `);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/limit") {
      return json({ error: "NOT_FOUND" }, 404);
    }

    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return json({ error: "BAD_REQUEST" }, 400);
    }
    if (!isLimitRequest(input)) {
      return json({ error: "BAD_REQUEST" }, 400);
    }

    const row = this.storage.sql
      .exec<BucketRow>(
        "SELECT window_id, request_count FROM rate_limit_bucket WHERE singleton = 1",
      )
      .toArray()[0];
    const previous: FixedWindowState | null = row
      ? { windowId: Number(row.window_id), requestCount: Number(row.request_count) }
      : null;
    const result = consumeFixedWindow(
      previous,
      Date.now(),
      input.limit,
      input.period_seconds,
    );

    if (result.success || previous?.windowId !== result.state.windowId) {
      this.storage.sql.exec(
        `INSERT INTO rate_limit_bucket (singleton, window_id, request_count)
         VALUES (1, ?, ?)
         ON CONFLICT(singleton) DO UPDATE SET
           window_id = excluded.window_id,
           request_count = excluded.request_count`,
        result.state.windowId,
        result.state.requestCount,
      );
    }

    return json({
      success: result.success,
      retry_after_seconds: result.retryAfterSeconds,
    });
  }
}
