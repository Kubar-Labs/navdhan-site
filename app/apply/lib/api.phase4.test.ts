import { afterEach, describe, expect, it, vi } from "vitest";

import {
  addCreditFacility,
  deleteRequirementDocument,
  fetchCreditFacilities,
  fetchRequirements,
  saveCreditDeclaration,
  uploadRequirementDocument,
} from "./api";
import type { RequirementsResponse } from "./types";

afterEach(() => vi.unstubAllGlobals());

const REQUIREMENTS_RESPONSE: RequirementsResponse = {
  application_id: "application-1",
  lock_version: 3,
  credit_declaration: { has_active_credit_facilities: null, declared_cibil_score: null },
  facilities: [],
  requirements: [],
};

describe("Phase 4 apply API client", () => {
  it("fetches the requirements checklist", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(REQUIREMENTS_RESPONSE));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchRequirements();

    expect(result).toEqual(REQUIREMENTS_RESPONSE);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/apply/applications/current/requirements");
    expect(init.credentials).toBe("same-origin");
  });

  it("fetches credit facilities", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(REQUIREMENTS_RESPONSE));
    vi.stubGlobal("fetch", fetchMock);

    await fetchCreditFacilities();

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/apply/applications/current/credit-facilities");
  });

  it("writes the credit declaration with CSRF header and JSON body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(REQUIREMENTS_RESPONSE));
    vi.stubGlobal("fetch", fetchMock);

    const payload = {
      has_active_credit_facilities: true,
      declared_cibil_score: 750,
      expected_lock_version: 2,
    };
    await saveCreditDeclaration(payload);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/apply/applications/current/credit-declaration");
    expect(init.method).toBe("PUT");
    expect(new Headers(init.headers).get("x-navdhan-requested-with")).toBe("apply");
    expect(JSON.parse(String(init.body))).toEqual(payload);
  });

  it("posts a new credit facility", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(REQUIREMENTS_RESPONSE));
    vi.stubGlobal("fetch", fetchMock);

    const payload = {
      facility_type: "business" as const,
      lender_name: "Test Bank",
      original_loan_amount: 200000,
      outstanding_amount: 100000,
      emi_amount: 5000,
      interest_rate_percent: 11.5,
      tenure_months: 36,
      start_date: "2024-01-01",
      end_date: "2027-01-01",
      emis_paid_count: 12,
      expected_lock_version: 4,
    };
    await addCreditFacility(payload);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/apply/applications/current/credit-facilities");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual(payload);
  });

  it("uploads a document as multipart form data without forcing a JSON content-type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(REQUIREMENTS_RESPONSE));
    vi.stubGlobal("fetch", fetchMock);

    const file = new File([new Uint8Array([1, 2, 3])], "pan.pdf", { type: "application/pdf" });
    await uploadRequirementDocument({
      applicationRequirementId: "req-1",
      expectedLockVersion: 1,
      file,
      coverageFrom: "2024-04-01",
      coverageTo: "2025-03-31",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/apply/applications/current/documents");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("x-navdhan-requested-with")).toBe("apply");
    expect(new Headers(init.headers).get("content-type")).toBeNull();
    const body = init.body as FormData;
    expect(body.get("application_requirement_id")).toBe("req-1");
    expect(body.get("expected_lock_version")).toBe("1");
    expect(body.get("coverage_from")).toBe("2024-04-01");
    expect(body.get("coverage_to")).toBe("2025-03-31");
    expect((body.get("file") as File).name).toBe("pan.pdf");
  });

  it("deletes a document with the lock version in the query string", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(REQUIREMENTS_RESPONSE));
    vi.stubGlobal("fetch", fetchMock);

    await deleteRequirementDocument("doc-1", 5);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/apply/applications/current/documents/doc-1?expected_lock_version=5");
    expect(init.method).toBe("DELETE");
  });
});
