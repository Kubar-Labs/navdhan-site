import { describe, it, expect } from "vitest";
import type { Messages } from "@/src/lib/i18n/messages";
import { useTeamLocalization } from "@/src/lib/i18n/team-mapper.stub";
import * as rawValidation from "@/src/lib/apply/validation.stub";
import * as rawIdempotency from "@/src/lib/apply/server/idempotency.stub";
import * as rawInitialize from "@/src/lib/apply/server/initialize-application.stub";
import * as rawSubmit from "@/src/lib/apply/server/submit-application.stub";

interface ApplyFormPayload {
  loan_amount: number;
  tenure_months: number;
  purpose: string;
  referral_code?: string | null;
  full_name: string;
  mobile_number: string;
  email: string;
  business_pin_code: string;
  aadhaar_number: string;
  aadhaar_otp?: string;
  aadhaar_consent: boolean;
  pan_number: string;
  pan_consent: boolean;
  gst_registered: boolean;
  gstin?: string;
  gst_consent?: boolean;
  annual_turnover: string;
  itr_document?: { name: string; type: "application/pdf"; size: number; url: string };
  itr_consent?: boolean;
  bank_linked?: boolean;
  bank_consent?: boolean;
  privacy_consent: boolean;
  terms_consent: boolean;
  credit_consent: boolean;
  communication_consent: boolean;
  application_reference?: string;
}

type ValidationModule = typeof rawValidation & {
  validateAadhaarNumber: (value: unknown) => string[];
  validateAadhaarConsent: (value: unknown) => string[];
  validateMobileNumber: (value: unknown) => string[];
  validatePanNumber: (value: unknown) => string[];
  validateGstin: (value: unknown, options?: { gstRegistered?: boolean }) => string[];
  validateAnnualTurnover: (value: unknown) => string[];
};

type IdempotencyModule = typeof rawIdempotency & {
  checkIdempotencyKey: (input: { key: string; reference?: string }) => Promise<{
    status: "new" | "duplicate" | "error";
    existingReference?: string;
  }>;
  storeIdempotencyKey: (input: { key: string; reference: string }) => Promise<void>;
  validateGetResponse: (payload: unknown) => { valid: boolean; errors?: string[] };
  validatePatchPayload: (payload: unknown) => { valid: boolean; errors?: string[] };
  validatePostPayload: (payload: unknown) => { valid: boolean; errors?: string[] };
  getApplicationState: (reference: string) => Promise<ApplyFormPayload>;
  patchApplicationState: (
    reference: string,
    request: { idempotencyKey: string; partialFields: string[] },
  ) => Promise<{ saved: boolean }>;
};

type InitializeModule = typeof rawInitialize & {
  initializeApplication: (input: {
    idempotencyKey: string;
  }) => Promise<{ application_reference: string }>;
};

type SubmitModule = typeof rawSubmit & {
  submitApplication: (input: { payload: ApplyFormPayload; idempotencyKey: string }) => Promise<{
    application_reference: string;
    status: string;
    message: string;
    offers_available?: boolean;
  }>;
};

const validation = rawValidation as unknown as ValidationModule;
const idempotency = rawIdempotency as unknown as IdempotencyModule;
const initialize = rawInitialize as unknown as InitializeModule;
const submit = rawSubmit as unknown as SubmitModule;

function buildValidPayload(): ApplyFormPayload {
  return {
    loan_amount: 1_000_000,
    tenure_months: 6,
    purpose: "working_capital",
    referral_code: "NAV2026",
    full_name: "Amit Sharma",
    mobile_number: "9876543210",
    email: "applicant@kubar.tech",
    business_pin_code: "110001",
    aadhaar_number: "123456789012",
    aadhaar_consent: true,
    pan_number: "ABCDE1234F",
    pan_consent: true,
    gst_registered: false,
    annual_turnover: "10_50",
    privacy_consent: true,
    terms_consent: true,
    credit_consent: true,
    communication_consent: true,
  };
}

describe("Team Localization Mapping", () => {
  const enMessages: Messages = {
    team: {
      members: {
        items: {
          "vaibhav-sharma": {
            role: "Founder & Head of Product",
            bio: "Building NavDhan to make MSME credit calm, fair and accessible across India.",
          },
          "agniva-ray": {
            role: "Operations",
          },
        },
      },
      advisors: {
        items: {
          "debayan-gupta": {
            domain: "Professor, CS - MIT, Ashoka University",
            contribution: "Advises on research-led technology choices and academic partnerships.",
          },
        },
      },
    },
  } as Messages;

  it("returns translated member role when it exists in the catalog", () => {
    const api = useTeamLocalization(enMessages, "en");
    expect(api.getMemberCopy("vaibhav-sharma", "role")).toBe("Founder & Head of Product");
  });

  it("returns translated member bio when it exists in the catalog", () => {
    const api = useTeamLocalization(enMessages, "en");
    expect(api.getMemberCopy("vaibhav-sharma", "bio")).toBe(
      "Building NavDhan to make MSME credit calm, fair and accessible across India.",
    );
  });

  it("falls back to the raw key from team.json when the translation is missing", () => {
    const api = useTeamLocalization(enMessages, "en");
    expect(api.getMemberCopy("agniva-ray", "bio")).toBe(
      "People and Internal Systems | 7 YOE | Ex- Govt. Of Goa",
    );
  });

  it("resolves translated advisor domain when it exists in the catalog", () => {
    const api = useTeamLocalization(enMessages, "en");
    expect(api.getAdvisorCopy("debayan-gupta", "domain")).toBe(
      "Professor, CS - MIT, Ashoka University",
    );
  });

  it("resolves translated advisor contribution when it exists in the catalog", () => {
    const api = useTeamLocalization(enMessages, "en");
    expect(api.getAdvisorCopy("debayan-gupta", "contribution")).toBe(
      "Advises on research-led technology choices and academic partnerships.",
    );
  });

  it("uses fallback locale when the active locale misses a team key", () => {
    const hiMessages: Messages = {
      team: {
        members: {
          items: {
            "vaibhav-sharma": {
              role: "Founder & Head of Product",
            },
          },
        },
      },
    } as Messages;
    const api = useTeamLocalization(hiMessages, "hi", "en");
    expect(api.getMemberCopy("vaibhav-sharma", "bio")).toBe(
      "Building NavDhan to make MSME credit calm, fair and accessible across India.",
    );
  });
});

describe("Premium Apply Form Client-Side Validations", () => {
  describe("aadhaar_number", () => {
    it("accepts exactly 12 digits", () => {
      expect(
        validation.validateAadhaarNumber?.("123456789012") ?? ["not_implemented"],
      ).toHaveLength(0);
    });

    it("rejects 11 digits", () => {
      expect(typeof validation.validateAadhaarNumber).toBe("function");
      expect(validation.validateAadhaarNumber("12345678901")).toContain("invalid_format");
    });

    it("rejects 13 digits", () => {
      expect(typeof validation.validateAadhaarNumber).toBe("function");
      expect(validation.validateAadhaarNumber("1234567890123")).toContain("invalid_format");
    });

    it("rejects values containing non-digits", () => {
      expect(typeof validation.validateAadhaarNumber).toBe("function");
      expect(validation.validateAadhaarNumber("12345678901A")).toContain("invalid_format");
    });
  });

  describe("aadhaar_consent", () => {
    it("accepts explicit consent", () => {
      expect(validation.validateAadhaarConsent?.(true) ?? ["not_implemented"]).toHaveLength(0);
    });

    it("rejects missing consent", () => {
      expect(typeof validation.validateAadhaarConsent).toBe("function");
      expect(validation.validateAadhaarConsent(false)).toContain("consent_missing");
    });

    it("rejects undefined consent", () => {
      expect(typeof validation.validateAadhaarConsent).toBe("function");
      expect(validation.validateAadhaarConsent(undefined)).toContain("consent_missing");
    });
  });

  describe("mobile_number", () => {
    it("accepts a 10-digit Indian mobile starting with 6-9", () => {
      expect(validation.validateMobileNumber?.("9876543210") ?? ["not_implemented"]).toHaveLength(
        0,
      );
    });

    it("rejects numbers starting with 0-5", () => {
      expect(typeof validation.validateMobileNumber).toBe("function");
      expect(validation.validateMobileNumber("5123456789")).toContain("invalid_format");
    });

    it("rejects 9 digits", () => {
      expect(typeof validation.validateMobileNumber).toBe("function");
      expect(validation.validateMobileNumber("987654321")).toContain("invalid_format");
    });

    it("rejects 11 digits", () => {
      expect(typeof validation.validateMobileNumber).toBe("function");
      expect(validation.validateMobileNumber("98765432100")).toContain("invalid_format");
    });

    it("rejects values with country code prefix", () => {
      expect(typeof validation.validateMobileNumber).toBe("function");
      expect(validation.validateMobileNumber("+919876543210")).toContain("invalid_format");
    });
  });

  describe("pan_number", () => {
    it("accepts uppercase PAN in standard format", () => {
      expect(validation.validatePanNumber?.("ABCDE1234F") ?? ["not_implemented"]).toHaveLength(0);
    });

    it("rejects lowercase PAN", () => {
      expect(typeof validation.validatePanNumber).toBe("function");
      expect(validation.validatePanNumber("abcde1234f")).toContain("invalid_format");
    });

    it("rejects wrong structure", () => {
      expect(typeof validation.validatePanNumber).toBe("function");
      expect(validation.validatePanNumber("ABCD12345F")).toContain("invalid_format");
    });

    it("rejects non-alphanumeric characters", () => {
      expect(typeof validation.validatePanNumber).toBe("function");
      expect(validation.validatePanNumber("ABCDE-1234F")).toContain("invalid_format");
    });
  });

  describe("gstin", () => {
    it("accepts a valid 15-digit uppercase GSTIN when registered", () => {
      expect(
        validation.validateGstin?.("27AAPFU0939F1ZV", {
          gstRegistered: true,
        }) ?? ["not_implemented"],
      ).toHaveLength(0);
    });

    it("ignores GSTIN when the business is not registered", () => {
      expect(
        validation.validateGstin?.(null, { gstRegistered: false }) ?? ["not_implemented"],
      ).toHaveLength(0);
    });

    it("rejects an invalid GSTIN when registered", () => {
      expect(validation.validateGstin("INVALID", { gstRegistered: true })).toContain(
        "invalid_format",
      );
    });

    it("rejects lowercase GSTIN when registered", () => {
      expect(validation.validateGstin("27aapfu0939f1zv", { gstRegistered: true })).toContain(
        "invalid_format",
      );
    });

    it("rejects a 14-character GSTIN when registered", () => {
      expect(validation.validateGstin("27AAPFU0939F1Z", { gstRegistered: true })).toContain(
        "invalid_format",
      );
    });
  });

  describe("annual_turnover", () => {
    it.each(["0_10", "10_50", "50_100", "100_500", "500_plus"])("accepts %s", (choice) => {
      expect(validation.validateAnnualTurnover?.(choice) ?? ["not_implemented"]).toHaveLength(0);
    });

    it("rejects an arbitrary value outside the choices", () => {
      expect(typeof validation.validateAnnualTurnover).toBe("function");
      expect(validation.validateAnnualTurnover("999_lakhs")).toContain("invalid_choice");
    });
  });
});

describe("Idempotency & State Sync Contracts", () => {
  describe("idempotency key lifecycle", () => {
    it("initializes an application and returns a reference", async () => {
      expect(typeof initialize.initializeApplication).toBe("function");
      const result = await initialize.initializeApplication({
        idempotencyKey: "123e4567-e89b-12d3-a456-426614174000",
      });
      expect(result.application_reference).toEqual(expect.any(String));
      expect(result.application_reference.length).toBeGreaterThan(0);
    });

    it("reports a fresh idempotency key as new", async () => {
      expect(typeof idempotency.checkIdempotencyKey).toBe("function");
      const result = await idempotency.checkIdempotencyKey({
        key: "123e4567-e89b-12d3-a456-426614174001",
      });
      expect(result.status).toBe("new");
    });

    it("reports a stored idempotency key as duplicate with the existing reference", async () => {
      expect(typeof idempotency.storeIdempotencyKey).toBe("function");
      expect(typeof idempotency.checkIdempotencyKey).toBe("function");
      const key = "123e4567-e89b-12d3-a456-426614174002";
      const reference = "REF-TEST-001";
      await idempotency.storeIdempotencyKey({ key, reference });
      const result = await idempotency.checkIdempotencyKey({ key });
      expect(result.status).toBe("duplicate");
      expect(result.existingReference).toBe(reference);
    });
  });

  describe("API payload schema conformance", () => {
    it("POST payload conforms to ApplyFormPayload schema", () => {
      expect(typeof idempotency.validatePostPayload).toBe("function");
      const result = idempotency.validatePostPayload(buildValidPayload());
      expect(result.valid).toBe(true);
      expect(result.errors ?? []).toHaveLength(0);
    });

    it("PATCH payload contains only valid ApplyFormPayload field names", () => {
      expect(typeof idempotency.validatePatchPayload).toBe("function");
      const result = idempotency.validatePatchPayload({
        idempotencyKey: "123e4567-e89b-12d3-a456-426614174003",
        partialFields: ["loan_amount", "aadhaar_number", "invalid_field_name"],
      });
      expect(result.valid).toBe(false);
      expect(result.errors ?? []).toContain("invalid_field_name");
    });

    it("GET response conforms to ApplyFormPayload schema", () => {
      expect(typeof idempotency.validateGetResponse).toBe("function");
      const result = idempotency.validateGetResponse(buildValidPayload());
      expect(result.valid).toBe(true);
      expect(result.errors ?? []).toHaveLength(0);
    });

    it("GET response rejects payloads missing required PII fields", () => {
      expect(typeof idempotency.validateGetResponse).toBe("function");
      const { aadhaar_number, mobile_number, pan_number, ...partial } = buildValidPayload();
      void aadhaar_number;
      void mobile_number;
      void pan_number;
      const result = idempotency.validateGetResponse(partial);
      expect(result.valid).toBe(false);
    });
  });

  describe("submit and patch endpoints", () => {
    it("submitApplication returns a SubmissionResult", async () => {
      expect(typeof submit.submitApplication).toBe("function");
      const result = await submit.submitApplication({
        payload: buildValidPayload(),
        idempotencyKey: "123e4567-e89b-12d3-a456-426614174004",
      });
      expect(result.application_reference).toEqual(expect.any(String));
      expect(result.status).toBe("success");
    });

    it("patchApplicationState reports that state was saved", async () => {
      expect(typeof idempotency.patchApplicationState).toBe("function");
      const result = await idempotency.patchApplicationState("REF-TEST-002", {
        idempotencyKey: "123e4567-e89b-12d3-a456-426614174005",
        partialFields: ["annual_turnover", "gstin"],
      });
      expect(result.saved).toBe(true);
    });
  });
});

describe("Brand tagline match validation", () => {
  it("hero headline matches the approved tagline", () => {
    const api = useTeamLocalization(
      {
        home: { hero: { headline: "One stop-solution for all your working capital needs" } },
      } as Messages,
      "en",
    );
    // @ts-expect-error getBrandTagline is not yet implemented in the localization API
    expect(api.getBrandTagline()).toBe("One stop-solution for all your working capital needs");
  });

  it("footer tagline matches the approved tagline", () => {
    const api = useTeamLocalization(
      {
        global: { footer: { tagline: "One stop-solution for all your working capital needs" } },
      } as Messages,
      "en",
    );
    // @ts-expect-error getBrandTagline is not yet implemented in the localization API
    expect(api.getBrandTagline()).toBe("One stop-solution for all your working capital needs");
  });
});
