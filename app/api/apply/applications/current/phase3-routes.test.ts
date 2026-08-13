import { afterEach, describe, expect, it, vi } from "vitest";

import { PUT as putBusinessProfile } from "./business-profile/route";
import { PUT as putPrimaryPerson } from "./primary-person/route";
import { POST as postParty } from "./parties/route";
import { PUT as putParty } from "./parties/[partyId]/route";
import { PUT as putPan } from "./parties/[partyId]/identifiers/pan/route";
import { PUT as putAadhaar } from "./parties/[partyId]/identifiers/aadhaar/route";
import { PUT as putEntityPan } from "./entity-pan/route";
import { PUT as putGst } from "./gst-registration/route";

const PARTY_ID = "10000000-0000-4000-8000-000000000001";
const HEADERS = {
  "content-type": "application/json",
  cookie: "__Host-nd_session=synthetic-token",
  "x-navdhan-requested-with": "apply",
};

afterEach(() => vi.unstubAllGlobals());

function request(path: string, body: unknown, method = "PUT"): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: HEADERS,
    body: JSON.stringify(body),
  });
}

describe("Phase 3 collection routes", () => {
  it.each([
    [
      "business profile",
      putBusinessProfile,
      "/api/apply/applications/current/business-profile",
      {
        business_legal_name: "NavDhan Traders",
        business_type_code: "trading",
        income_type_code: "business_income",
        type_of_office: "rented_office",
        location_tier: "tier2",
        business_pincode: "560001",
        annual_turnover_range: "10_50",
        gst_registered: true,
        expected_lock_version: 1,
      },
    ],
    [
      "primary person",
      putPrimaryPerson,
      "/api/apply/applications/current/primary-person",
      {
        full_name: "Anita Rao",
        mobile_number: "9876543210",
        email: "anita@example.com",
        type_of_residence: "owned",
        employment_status_code: "self_employed",
        expected_lock_version: 2,
      },
    ],
    [
      "entity PAN",
      putEntityPan,
      "/api/apply/applications/current/entity-pan",
      { entity_pan: "ABCDE1234F", expected_lock_version: 3 },
    ],
    [
      "GST registration",
      putGst,
      "/api/apply/applications/current/gst-registration",
      {
        gst_registered: true,
        state_code: "27",
        gstin: "27ABCDE1234F1Z5",
        expected_lock_version: 4,
      },
    ],
  ])("forwards the %s contract", async (_name, handler, path, body) => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ lock_version: 9 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await handler(request(path as string, body));

    expect(response.status).toBe(200);
    const [backendUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(backendUrl).toBe(`http://127.0.0.1:8000${path}`);
    expect(JSON.parse(String(init.body))).toEqual(body);
  });

  it("creates only an allowlisted additional party", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ lock_version: 2 }));
    vi.stubGlobal("fetch", fetchMock);
    const body = {
      full_name: "Ravi Shah",
      mobile_number: "9876543210",
      email: "ravi@example.com",
      type_of_residence: "rented",
      employment_status_code: "self_employed",
      role: "co_applicant",
      ownership_pct: 25,
      expected_lock_version: 1,
    };

    const response = await postParty(
      request("/api/apply/applications/current/parties", body, "POST"),
    );

    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:8000/api/apply/applications/current/parties");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual(body);
  });

  it("updates a party without permitting its role to change", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ lock_version: 3 }));
    vi.stubGlobal("fetch", fetchMock);
    const input = {
      full_name: "Ravi Shah",
      mobile_number: "9876543210",
      email: "ravi@example.com",
      type_of_residence: "owned",
      employment_status_code: "self_employed",
      role: "director",
      ownership_pct: 40,
      expected_lock_version: 2,
    };

    const response = await putParty(
      request(`/api/apply/applications/current/parties/${PARTY_ID}`, input),
      {
        params: Promise.resolve({ partyId: PARTY_ID }),
      },
    );

    expect(response.status).toBe(200);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      full_name: "Ravi Shah",
      mobile_number: "9876543210",
      email: "ravi@example.com",
      type_of_residence: "owned",
      employment_status_code: "self_employed",
      ownership_pct: 40,
      expected_lock_version: 2,
    });
  });

  it("forwards separate person PAN and Aadhaar writes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ lock_version: 4 }));
    vi.stubGlobal("fetch", fetchMock);
    const context = { params: Promise.resolve({ partyId: PARTY_ID }) };

    await putPan(request("/pan", { pan_number: "ABCDE1234F", expected_lock_version: 2 }), context);
    await putAadhaar(
      request("/aadhaar", { aadhaar_number: "123412341234", expected_lock_version: 3 }),
      context,
    );

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `http://127.0.0.1:8000/api/apply/applications/current/parties/${PARTY_ID}/identifiers/pan`,
      `http://127.0.0.1:8000/api/apply/applications/current/parties/${PARTY_ID}/identifiers/aadhaar`,
    ]);
  });

  it("rejects unsafe party identifiers before proxying", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await putPan(
      request("/pan", { pan_number: "ABCDE1234F", expected_lock_version: 2 }),
      {
        params: Promise.resolve({ partyId: "../entity-pan" }),
      },
    );

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
