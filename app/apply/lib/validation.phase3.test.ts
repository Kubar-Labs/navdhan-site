import { describe, expect, it } from "vitest";

import {
  validateAadhaarIdentity,
  validateBusinessProfile,
  validateEntityPan,
  validateGstRegistration,
  validateParty,
  validatePanIdentity,
} from "./validation";

describe("Phase 3 collection validators", () => {
  it("accepts the frozen business-profile allowlists and strips unknown fields", () => {
    const result = validateBusinessProfile({
      business_legal_name: "NavDhan Traders",
      trade_name: "NavDhan",
      business_type_code: "trading",
      income_type_code: "business_income",
      type_of_office: "rented_office",
      location_tier: "tier2",
      business_pincode: "560001",
      annual_turnover_range: "10_50",
      gst_registered: true,
      expected_lock_version: 2,
      ignored: "not-forwarded",
    });

    expect(result.errors).toEqual([]);
    expect(result.value).toEqual({
      business_legal_name: "NavDhan Traders",
      trade_name: "NavDhan",
      business_type_code: "trading",
      income_type_code: "business_income",
      type_of_office: "rented_office",
      location_tier: "tier2",
      business_pincode: "560001",
      annual_turnover_range: "10_50",
      gst_registered: true,
      expected_lock_version: 2,
    });
  });

  it.each([
    {
      business_legal_name: "N",
      business_type_code: "trading",
      income_type_code: "business_income",
      type_of_office: "owned_office",
      location_tier: "tier1",
      business_pincode: "560001",
      annual_turnover_range: "10_50",
      gst_registered: false,
      expected_lock_version: 0,
    },
    {
      business_legal_name: "NavDhan",
      business_type_code: "unknown",
      income_type_code: "business_income",
      type_of_office: "owned_office",
      location_tier: "tier1",
      business_pincode: "560001",
      annual_turnover_range: "10_50",
      gst_registered: false,
      expected_lock_version: 0,
    },
    {
      business_legal_name: "NavDhan",
      business_type_code: "trading",
      income_type_code: "business_income",
      type_of_office: "owned_office",
      location_tier: "metro",
      business_pincode: "560001",
      annual_turnover_range: "10_50",
      gst_registered: false,
      expected_lock_version: 0,
    },
    {
      business_legal_name: "NavDhan",
      business_type_code: "trading",
      income_type_code: "business_income",
      type_of_office: "owned_office",
      location_tier: "tier1",
      business_pincode: "000000",
      annual_turnover_range: "10_50",
      gst_registered: false,
      expected_lock_version: 0,
    },
    {
      business_legal_name: "NavDhan",
      business_type_code: "trading",
      income_type_code: "business_income",
      type_of_office: "owned_office",
      location_tier: "tier1",
      business_pincode: "560001",
      annual_turnover_range: "invented",
      gst_registered: false,
      expected_lock_version: 0,
    },
  ])("rejects an invalid business profile (%o)", (payload) => {
    expect(validateBusinessProfile(payload).value).toBeUndefined();
  });

  it("accepts a party and only forwards collection fields", () => {
    const result = validateParty({
      full_name: "Anita Rao",
      mobile_number: "9876543210",
      email: "anita@example.com",
      type_of_residence: "owned",
      employment_status_code: "self_employed",
      role: "co_applicant",
      expected_lock_version: 4,
      provider_verification: true,
    });

    expect(result.errors).toEqual([]);
    expect(result.value).toEqual({
      full_name: "Anita Rao",
      mobile_number: "9876543210",
      email: "anita@example.com",
      type_of_residence: "owned",
      employment_status_code: "self_employed",
      role: "co_applicant",
      expected_lock_version: 4,
    });
  });

  it.each([
    {
      full_name: "A",
      mobile_number: "9876543210",
      email: "a@example.com",
      type_of_residence: "owned",
      employment_status_code: "self_employed",
      role: "applicant",
      expected_lock_version: 0,
    },
    {
      full_name: "Anita Rao",
      mobile_number: "123",
      email: "a@example.com",
      type_of_residence: "owned",
      employment_status_code: "self_employed",
      role: "applicant",
      expected_lock_version: 0,
    },
    {
      full_name: "Anita Rao",
      mobile_number: "9876543210",
      email: "invalid",
      type_of_residence: "owned",
      employment_status_code: "self_employed",
      role: "applicant",
      expected_lock_version: 0,
    },
    {
      full_name: "Anita Rao",
      mobile_number: "9876543210",
      email: "a@example.com",
      type_of_residence: "hotel",
      employment_status_code: "self_employed",
      role: "applicant",
      expected_lock_version: 0,
    },
    {
      full_name: "Anita Rao",
      mobile_number: "9876543210",
      email: "a@example.com",
      type_of_residence: "owned",
      employment_status_code: "retired",
      role: "applicant",
      expected_lock_version: 0,
    },
    {
      full_name: "Anita Rao",
      mobile_number: "9876543210",
      email: "a@example.com",
      type_of_residence: "owned",
      employment_status_code: "self_employed",
      role: "admin",
      expected_lock_version: 0,
    },
  ])("rejects an invalid party (%o)", (payload) => {
    expect(validateParty(payload).value).toBeUndefined();
  });

  it("validates personal PAN and Aadhaar independently", () => {
    expect(validatePanIdentity({ pan_number: "ABCDE1234F", expected_lock_version: 1 })).toEqual({
      value: { pan_number: "ABCDE1234F", expected_lock_version: 1 },
      errors: [],
    });
    expect(
      validateAadhaarIdentity({ aadhaar_number: "123412341234", expected_lock_version: 2 }),
    ).toEqual({
      value: { aadhaar_number: "123412341234", expected_lock_version: 2 },
      errors: [],
    });
    expect(
      validatePanIdentity({ pan_number: "bad", expected_lock_version: 1 }).value,
    ).toBeUndefined();
    expect(
      validateAadhaarIdentity({ aadhaar_number: "1234", expected_lock_version: 2 }).value,
    ).toBeUndefined();
  });

  it("validates entity PAN without requiring a provider call", () => {
    expect(
      validateEntityPan({
        entity_pan: "ABCDE1234F",
        expected_lock_version: 3,
      }),
    ).toEqual({
      value: { entity_pan: "ABCDE1234F", expected_lock_version: 3 },
      errors: [],
    });
    expect(
      validateEntityPan({ entity_pan: "bad", expected_lock_version: 4 }).value,
    ).toBeUndefined();
  });

  it("requires a valid GST state that matches the GSTIN prefix", () => {
    expect(
      validateGstRegistration({
        gst_registered: true,
        gst_consent: true,
        state_code: "29",
        gstin: "27ABCDE1234F1Z5",
        expected_lock_version: 0,
      }).value,
    ).toBeUndefined();
    expect(
      validateGstRegistration({
        gst_registered: true,
        gst_consent: true,
        state_code: "99",
        gstin: "27ABCDE1234F1Z5",
        expected_lock_version: 0,
      }).value,
    ).toBeUndefined();
    expect(
      validateGstRegistration({
        gst_registered: false,
        gst_consent: false,
        state_code: null,
        gstin: null,
        expected_lock_version: 1,
      }),
    ).toEqual({
      value: { gst_registered: false, gst_consent: false, expected_lock_version: 1 },
      errors: [],
    });

    expect(
      validateGstRegistration({
        gst_registered: true,
        gst_consent: false,
        state_code: "27",
        gstin: "27ABCDE1234F1Z5",
        expected_lock_version: 0,
      }).errors,
    ).toContainEqual(expect.objectContaining({ field: "gst_consent" }));

    expect(
      validateGstRegistration({
        gst_registered: true,
        gst_consent: true,
        state_code: "27",
        gstin: "",
        expected_lock_version: 0,
      }).value,
    ).toBeUndefined();

    expect(
      validateGstRegistration({
        gst_registered: false,
        gst_consent: true,
        expected_lock_version: 0,
      }).value,
    ).toBeUndefined();
  });
});
