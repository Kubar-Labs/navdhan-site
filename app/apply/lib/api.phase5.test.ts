import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchConsentStatus, saveConsentGrants, submitCollectionApplication } from "./api";
import type { ConsentStatusResponse, SubmitApplicationResponse } from "./types";

afterEach(() => vi.unstubAllGlobals());

const CONSENT_RESPONSE: ConsentStatusResponse = {
  application_id: "application-1",
  lock_version: 3,
  purposes: [
    {
      purpose_code: "privacy_policy",
      display_name: "I agree to the Privacy Policy",
      notice_text: "I agree to the Privacy Policy",
      notice_version: 1,
      is_mandatory: true,
      granted: false,
    },
  ],
};

const SUBMIT_RESPONSE: SubmitApplicationResponse = {
  application_id: "application-1",
  application_no: "ND-ABCDEF123456",
  status: "submitted",
  submitted_at: "2026-08-14T00:00:00+00:00",
  lock_version: 4,
};

describe("Phase 5 apply API client", () => {
  it("fetches consent status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(CONSENT_RESPONSE));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchConsentStatus();

    expect(result).toEqual(CONSENT_RESPONSE);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/apply/applications/current/consent");
    expect(init.credentials).toBe("same-origin");
  });

  it("writes consent grants with CSRF header and JSON body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(CONSENT_RESPONSE));
    vi.stubGlobal("fetch", fetchMock);

    const payload = {
      grants: { privacy_policy: true, terms_of_use: true, credit_bureau_check: true, communications: false },
      expected_lock_version: 3,
    };
    await saveConsentGrants(payload);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/apply/applications/current/consent");
    expect(init.method).toBe("PUT");
    expect(new Headers(init.headers).get("x-navdhan-requested-with")).toBe("apply");
    expect(JSON.parse(String(init.body))).toEqual(payload);
  });

  it("submits the application via POST", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(SUBMIT_RESPONSE));
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitCollectionApplication({ expected_lock_version: 4 });

    expect(result).toEqual(SUBMIT_RESPONSE);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/apply/applications/current/submit");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ expected_lock_version: 4 });
  });
});
