import { afterEach, describe, expect, it, vi } from "vitest";

import { GET as getRequirements } from "./requirements/route";
import { PUT as putCreditDeclaration } from "./credit-declaration/route";
import {
  GET as getCreditFacilities,
  POST as postCreditFacility,
} from "./credit-facilities/route";
import { POST as postDocument } from "./documents/route";
import { DELETE as deleteDocument } from "./documents/[documentId]/route";

const DOCUMENT_ID = "10000000-0000-4000-8000-000000000002";
const REQUIREMENT_ID = "10000000-0000-4000-8000-000000000003";
const COOKIE = "__Host-nd_session=synthetic-token";
const JSON_HEADERS = {
  "content-type": "application/json",
  cookie: COOKIE,
  "x-navdhan-requested-with": "apply",
};

afterEach(() => vi.unstubAllGlobals());

function jsonRequest(path: string, body: unknown, method = "PUT"): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
}

describe("Phase 4 collection routes", () => {
  it("forwards the requirements GET", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ requirements: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await getRequirements(
      new Request("http://localhost/api/apply/applications/current/requirements", {
        headers: { cookie: COOKIE },
      }),
    );

    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:8000/api/apply/applications/current/requirements");
  });

  it("rejects the requirements GET without a session cookie", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await getRequirements(
      new Request("http://localhost/api/apply/applications/current/requirements"),
    );

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards the credit declaration write", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ lock_version: 2 }));
    vi.stubGlobal("fetch", fetchMock);
    const body = {
      has_active_credit_facilities: true,
      declared_cibil_score: 720,
      expected_lock_version: 1,
    };

    const response = await putCreditDeclaration(
      jsonRequest("/api/apply/applications/current/credit-declaration", body),
    );

    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:8000/api/apply/applications/current/credit-declaration");
    expect(JSON.parse(String(init.body))).toEqual(body);
  });

  it("rejects an out-of-range CIBIL score before proxying", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await putCreditDeclaration(
      jsonRequest("/api/apply/applications/current/credit-declaration", {
        has_active_credit_facilities: true,
        declared_cibil_score: 950,
        expected_lock_version: 1,
      }),
    );

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards the credit facilities GET and POST", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ facilities: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await getCreditFacilities(
      new Request("http://localhost/api/apply/applications/current/credit-facilities", {
        headers: { cookie: COOKIE },
      }),
    );
    const body = {
      facility_type: "business",
      lender_name: "Test Bank",
      original_loan_amount: 200000,
      outstanding_amount: 100000,
      emi_amount: 5000,
      interest_rate_percent: 11.5,
      tenure_months: 36,
      start_date: "2024-01-01",
      end_date: "2027-01-01",
      emis_paid_count: 12,
      expected_lock_version: 3,
    };
    await postCreditFacility(
      jsonRequest("/api/apply/applications/current/credit-facilities", body, "POST"),
    );

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "http://127.0.0.1:8000/api/apply/applications/current/credit-facilities",
      "http://127.0.0.1:8000/api/apply/applications/current/credit-facilities",
    ]);
    const postInit = fetchMock.mock.calls[1][1] as RequestInit;
    expect(JSON.parse(String(postInit.body))).toEqual(body);
  });

  it("forwards a multipart document upload as form data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ requirements: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const incoming = new FormData();
    incoming.set("file", new File([new Uint8Array([1, 2, 3])], "pan.pdf", { type: "application/pdf" }));
    incoming.set("application_requirement_id", REQUIREMENT_ID);
    incoming.set("expected_lock_version", "1");
    incoming.set("coverage_from", "2024-04-01");
    incoming.set("coverage_to", "2025-03-31");

    const response = await postDocument(
      new Request("http://localhost/api/apply/applications/current/documents", {
        method: "POST",
        headers: { cookie: COOKIE, "x-navdhan-requested-with": "apply" },
        body: incoming,
      }),
    );

    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:8000/api/apply/applications/current/documents");
    const forwarded = init.body as FormData;
    expect(forwarded.get("application_requirement_id")).toBe(REQUIREMENT_ID);
    expect(forwarded.get("expected_lock_version")).toBe("1");
    expect((forwarded.get("file") as File).name).toBe("pan.pdf");
  });

  it("rejects a document upload with an unsafe requirement id before proxying", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const incoming = new FormData();
    incoming.set("file", new File([new Uint8Array([1])], "pan.pdf", { type: "application/pdf" }));
    incoming.set("application_requirement_id", "../not-a-uuid");
    incoming.set("expected_lock_version", "1");

    const response = await postDocument(
      new Request("http://localhost/api/apply/applications/current/documents", {
        method: "POST",
        headers: { cookie: COOKIE, "x-navdhan-requested-with": "apply" },
        body: incoming,
      }),
    );

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards a document delete with the lock version as a query parameter", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ requirements: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await deleteDocument(
      new Request(
        `http://localhost/api/apply/applications/current/documents/${DOCUMENT_ID}?expected_lock_version=2`,
        { method: "DELETE", headers: { cookie: COOKIE, "x-navdhan-requested-with": "apply" } },
      ),
      { params: Promise.resolve({ documentId: DOCUMENT_ID }) },
    );

    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `http://127.0.0.1:8000/api/apply/applications/current/documents/${DOCUMENT_ID}?expected_lock_version=2`,
    );
    expect(init.method).toBe("DELETE");
  });

  it("rejects a document delete with an unsafe document id before proxying", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await deleteDocument(
      new Request(
        "http://localhost/api/apply/applications/current/documents/../escape?expected_lock_version=2",
        { method: "DELETE", headers: { cookie: COOKIE, "x-navdhan-requested-with": "apply" } },
      ),
      { params: Promise.resolve({ documentId: "../escape" }) },
    );

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
