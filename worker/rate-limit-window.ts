export interface FixedWindowState {
  windowId: number;
  requestCount: number;
}

export interface FixedWindowResult {
  success: boolean;
  retryAfterSeconds: number;
  state: FixedWindowState;
}

/**
 * Consume one request from an exact, wall-clock-aligned fixed window.
 * The caller serializes persistence; this pure function owns only the policy.
 */
export function consumeFixedWindow(
  previous: FixedWindowState | null,
  nowMs: number,
  limit: number,
  periodSeconds: number,
): FixedWindowResult {
  if (!Number.isFinite(nowMs) || nowMs < 0) throw new Error("Invalid clock value");
  if (!Number.isInteger(limit) || limit < 1) throw new Error("Invalid rate limit");
  if (!Number.isInteger(periodSeconds) || periodSeconds < 1) {
    throw new Error("Invalid rate-limit period");
  }

  const periodMs = periodSeconds * 1000;
  const windowId = Math.floor(nowMs / periodMs);
  const requestCount = previous?.windowId === windowId ? previous.requestCount : 0;

  if (requestCount >= limit) {
    const windowEndMs = (windowId + 1) * periodMs;
    return {
      success: false,
      retryAfterSeconds: Math.max(1, Math.ceil((windowEndMs - nowMs) / 1000)),
      state: { windowId, requestCount },
    };
  }

  return {
    success: true,
    retryAfterSeconds: 0,
    state: { windowId, requestCount: requestCount + 1 },
  };
}
