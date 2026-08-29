import { describe, expect, it } from "vitest";

import { consumeFixedWindow } from "./rate-limit-window";

describe("exact fixed-window rate limiting", () => {
  it("allows exactly the configured number of requests and then denies", () => {
    let state = null;
    for (let request = 1; request <= 10; request += 1) {
      const result = consumeFixedWindow(state, 12_000, 10, 60);
      expect(result.success).toBe(true);
      expect(result.retryAfterSeconds).toBe(0);
      state = result.state;
    }

    const denied = consumeFixedWindow(state, 12_001, 10, 60);
    expect(denied.success).toBe(false);
    expect(denied.state.requestCount).toBe(10);
    expect(denied.retryAfterSeconds).toBe(48);
  });

  it("resets at the next aligned window and bounds retry-after", () => {
    const full = { windowId: 0, requestCount: 10 };
    expect(consumeFixedWindow(full, 59_999, 10, 60)).toMatchObject({
      success: false,
      retryAfterSeconds: 1,
    });
    expect(consumeFixedWindow(full, 60_000, 10, 60)).toEqual({
      success: true,
      retryAfterSeconds: 0,
      state: { windowId: 1, requestCount: 1 },
    });
  });

  it("rejects invalid policy and clock inputs", () => {
    expect(() => consumeFixedWindow(null, -1, 10, 60)).toThrow("Invalid clock value");
    expect(() => consumeFixedWindow(null, 0, 0, 60)).toThrow("Invalid rate limit");
    expect(() => consumeFixedWindow(null, 0, 10, 0)).toThrow("Invalid rate-limit period");
  });
});
