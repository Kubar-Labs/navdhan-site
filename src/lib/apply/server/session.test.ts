import { describe, expect, it } from "vitest";

import { extractSessionId } from "./session";

describe("extractSessionId", () => {
  it("matches only the exact protected cookie name", () => {
    expect(
      extractSessionId(
        "x__Host-nd_session=attacker; __Host-nd_session=legitimate",
      ),
    ).toBe("legitimate");
    expect(
      extractSessionId(
        "foo=__Host-nd_session=attacker; __Host-nd_session=legitimate",
      ),
    ).toBe("legitimate");
  });
});
