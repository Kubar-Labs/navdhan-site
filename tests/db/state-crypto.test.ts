import { decryptState, encryptState } from "@/src/lib/state-crypto";
import { describe, expect, it } from "vitest";

const KEY = Buffer.from("0123456789abcdef0123456789abcdef", "utf8").toString("base64");

// ponytail: tests should fail if crypto logic breaks; we mutate env directly
// because vitest runs in-process and this is the simplest self-check.
process.env.APPLY_ENCRYPTION_KEY = KEY;
process.env.APPLY_KEY_ID = "v1";

describe("state-crypto", () => {
  it("round-trips a JSON payload", () => {
    const payload = JSON.stringify({
      mobileNumber: "9999999999",
      loanAmount: 500000,
      locale: "en",
    });
    const envelope = encryptState(payload);
    const decrypted = decryptState(envelope);
    expect(JSON.parse(decrypted)).toEqual(JSON.parse(payload));
  });

  it("produces different ciphertexts for identical plaintexts", () => {
    const payload = JSON.stringify({ loanAmount: 1000000 });
    const a = JSON.parse(encryptState(payload)) as { ct: string };
    const b = JSON.parse(encryptState(payload)) as { ct: string };
    expect(a.ct).not.toBe(b.ct);
  });

  it("rejects a tampered ciphertext", () => {
    const payload = JSON.stringify({ loanAmount: 1000000 });
    const parsed = JSON.parse(encryptState(payload)) as {
      v: number;
      kid: string;
      iv: string;
      ct: string;
      tag: string;
    };
    parsed.ct = parsed.ct.slice(0, -4) + "AAAA";
    expect(() => decryptState(JSON.stringify(parsed))).toThrow(
      "Encrypted state could not be authenticated",
    );
  });

  it("rejects an unsupported envelope version", () => {
    const payload = JSON.stringify({ loanAmount: 1000000 });
    const parsed = JSON.parse(encryptState(payload)) as { v: number };
    parsed.v = 99;
    expect(() => decryptState(JSON.stringify(parsed))).toThrow(
      "Unsupported encrypted state version: 99",
    );
  });

  it("rejects a missing encryption key", () => {
    const saved = process.env.APPLY_ENCRYPTION_KEY;
    process.env.APPLY_ENCRYPTION_KEY = "";
    try {
      expect(() => encryptState("test")).toThrow("Encryption key not configured");
    } finally {
      process.env.APPLY_ENCRYPTION_KEY = saved;
    }
  });
});
