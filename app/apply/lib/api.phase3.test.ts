import { afterEach, describe, expect, it, vi } from "vitest";

import {
  addApplicationParty,
  saveAadhaarIdentity,
  saveBusinessProfile,
  saveEntityPan,
  saveGstRegistration,
  savePanIdentity,
  savePrimaryPerson,
  updateApplicationParty,
} from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("Phase 3 apply API client", () => {
  it.each([
    [
      saveBusinessProfile,
      "/api/apply/applications/current/business-profile",
      {
        business_legal_name: "NavDhan Traders",
        business_type_code: "trading",
        income_type_code: "business_income",
        type_of_office: "owned_office",
        location_tier: "tier1",
        business_pincode: "560001",
        annual_turnover_range: "10_50",
        gst_registered: false,
        expected_lock_version: 1,
      },
    ],
    [
      savePrimaryPerson,
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
      addApplicationParty,
      "/api/apply/applications/current/parties",
      {
        full_name: "Ravi Shah",
        mobile_number: "9876543210",
        email: "ravi@example.com",
        type_of_residence: "rented",
        employment_status_code: "self_employed",
        role: "co_applicant",
        expected_lock_version: 3,
      },
    ],
    [
      saveEntityPan,
      "/api/apply/applications/current/entity-pan",
      { entity_pan: "ABCDE1234F", expected_lock_version: 4 },
    ],
    [
      saveGstRegistration,
      "/api/apply/applications/current/gst-registration",
      {
        gst_registered: true,
        gst_consent: true,
        state_code: "27",
        gstin: "27ABCDE1234F1Z5",
        expected_lock_version: 5,
      },
    ],
  ])("writes through %s", async (client, url, payload) => {
    const responseBody = {
      application_id: "application-1",
      current_step: "person",
      lock_version: 6,
      values: {},
    };
    const fetchMock = vi.fn().mockResolvedValue(Response.json(responseBody));
    vi.stubGlobal("fetch", fetchMock);

    await client(payload as never);

    const [actualUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(actualUrl).toBe(url);
    expect(init.credentials).toBe("same-origin");
    expect(new Headers(init.headers).get("x-navdhan-requested-with")).toBe("apply");
    expect(JSON.parse(String(init.body))).toEqual(payload);
  });

  it("uses the party resource paths for update and identity writes", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          Response.json({
            application_id: "application-1",
            current_step: "person",
            lock_version: 7,
            values: {},
          }),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const partyId = "10000000-0000-4000-8000-000000000001";
    const person = {
      full_name: "Ravi Shah",
      mobile_number: "9876543210",
      email: "ravi@example.com",
      type_of_residence: "owned" as const,
      employment_status_code: "self_employed" as const,
      expected_lock_version: 4,
    };

    await updateApplicationParty(partyId, person);
    await savePanIdentity(partyId, { pan_number: "ABCDE1234F", expected_lock_version: 5 });
    await saveAadhaarIdentity(partyId, {
      aadhaar_number: "123412341234",
      expected_lock_version: 6,
    });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `/api/apply/applications/current/parties/${partyId}`,
      `/api/apply/applications/current/parties/${partyId}/identifiers/pan`,
      `/api/apply/applications/current/parties/${partyId}/identifiers/aadhaar`,
    ]);
  });
});
