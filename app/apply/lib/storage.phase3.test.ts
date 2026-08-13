/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it } from "vitest";

import { loadDraftValues, saveDraftValues } from "./storage";
import { STORAGE_KEY } from "./constants";

describe("apply draft browser storage", () => {
  beforeEach(() => window.localStorage.clear());

  it("never persists plaintext identity or contact values", () => {
    saveDraftValues({
      loan_amount: 500_000,
      mobile_number: "9876543210",
      email: "anita@example.com",
      pan_number: "ABCDE1234F",
      aadhaar_number: "123412341234",
      gstin: "27ABCDE1234F1Z5",
      itr_document: { name: "Anita-Rao-ITR.pdf", type: "application/pdf", size: 20 },
    });

    const raw = window.localStorage.getItem(STORAGE_KEY) ?? "";
    expect(raw).toContain("500000");
    expect(raw).not.toContain("9876543210");
    expect(raw).not.toContain("anita@example.com");
    expect(raw).not.toContain("ABCDE1234F");
    expect(raw).not.toContain("123412341234");
    expect(raw).not.toContain("27ABCDE1234F1Z5");
    expect(raw).not.toContain("Anita-Rao-ITR.pdf");
    expect(loadDraftValues()).toEqual({ loan_amount: 500_000 });
  });
});
