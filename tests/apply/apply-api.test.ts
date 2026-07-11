import { describe, it, expect, beforeEach, vi } from "vitest";

// Route handlers are expected to be implemented in the GREEN phase.
// Import paths follow the Next.js 15 App Router convention.
import {
  GET as getApplyState,
  POST as postApplyState,
} from "@/app/api/apply/state/route";
import {
  POST as postOtpSend,
} from "@/app/api/apply/otp/send/route";
import {
  POST as postOtpVerify,
} from "@/app/api/apply/otp/verify/route";
import {
  POST as postUploadUrl,
} from "@/app/api/apply/documents/upload-url/route";
import {
  POST as postUploadDocument,
} from "@/app/api/apply/documents/upload/route";
import {
  POST as postPerfiosInitiate,
} from "@/app/api/apply/perfios/initiate/route";
import {
  POST as postPerfiosCallback,
} from "@/app/api/apply/perfios/callback/route";
import {
  GET as getPerfiosStatus,
} from "@/app/api/apply/perfios/status/route";
import {
  POST as postSubmit,
} from "@/app/api/apply/submit/route";
import {
  GET as getOffers,
} from "@/app/api/apply/offers/route";
import {
  POST as postConsent,
} from "@/app/api/apply/consent/route";

function makeRequest(
  url: string,
  options: RequestInit = {}
): ReturnType<typeof fetch extends (...args: any[]) => infer R ? R : never> {
  return new Request(url, options) as unknown as ReturnType<
    typeof fetch extends (...args: any[]) => infer R ? R : never
  >;
}

const baseHeaders: Record<string, string> = {
  "Content-Type": "application/json",
  "x-navdhan-requested-with": "apply",
};

const freshCookie = "__Host-nd_session=test-session-id; Path=/; HttpOnly; Secure; SameSite=Lax";

function makeJsonRequest(
  url: string,
  body?: unknown,
  cookie?: string
): Request {
  const headers = new Headers(baseHeaders);
  if (cookie) headers.append("Cookie", cookie);
  return new Request(url, {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeGetRequest(url: string, cookie?: string): Request {
  const headers = new Headers();
  if (cookie) headers.append("Cookie", cookie);
  return new Request(url, { method: "GET", headers });
}

describe("/api/apply/state", () => {
  it("GET returns draft application state for a valid session", async () => {
    const req = makeGetRequest(
      "https://navdhan.app/api/apply/state?locale=en",
      freshCookie
    );
    const res = await getApplyState(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("application_id");
    expect(json).toHaveProperty("current_step", "loan_intent");
    expect(json).toHaveProperty("status", "draft");
    expect(json).toHaveProperty("expires_at");
  });

  it("GET returns 401 when session cookie is missing", async () => {
    const req = makeGetRequest("https://navdhan.app/api/apply/state?locale=en");
    const res = await getApplyState(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("SESSION_INVALID");
    expect(json.message_i18n_key).toBe("apply.errors.sessionExpired");
  });

  it("POST updates loan_intent and returns next step", async () => {
    const req = makeJsonRequest(
      "https://navdhan.app/api/apply/state",
      {
        current_step: "loan_intent",
        payload: {
          loan_amount: 500000,
          tenure_months: 6,
          purpose: "working_capital",
          referral_code: null,
        },
      },
      freshCookie
    );
    const res = await postApplyState(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.current_step).toBe("personal_contact");
  });

  it("POST returns 400 for invalid loan_intent payload", async () => {
    const req = makeJsonRequest(
      "https://navdhan.app/api/apply/state",
      {
        current_step: "loan_intent",
        payload: {
          loan_amount: 499999,
          tenure_months: 2,
          purpose: "invalid_purpose",
        },
      },
      freshCookie
    );
    const res = await postApplyState(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("VALIDATION_ERROR");
    expect(Array.isArray(json.field_errors)).toBe(true);
    const fields = json.field_errors.map((e: { field: string }) => e.field);
    expect(fields).toContain("loan_amount");
    expect(fields).toContain("tenure_months");
    expect(fields).toContain("purpose");
  });

  it("POST returns 409 for invalid step transition", async () => {
    const req = makeJsonRequest(
      "https://navdhan.app/api/apply/state",
      {
        application_id: "11111111-1111-1111-1111-111111111111",
        current_step: "aadhaar_verification",
        payload: {
          aadhaar_number: "123456789012",
          aadhaar_otp: "123456",
        },
      },
      freshCookie
    );
    const res = await postApplyState(req);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("INVALID_TRANSITION");
    expect(json).toHaveProperty("current_step");
    expect(json).toHaveProperty("expected_step");
  });

  it("POST returns 403 when CSRF header is missing", async () => {
    const req = new Request("https://navdhan.app/api/apply/state", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: freshCookie },
      body: JSON.stringify({
        current_step: "loan_intent",
        payload: { loan_amount: 500000, tenure_months: 6, purpose: "working_capital" },
      }),
    });
    const res = await postApplyState(req);
    expect(res.status).toBe(403);
  });
});

describe("/api/apply/otp/send", () => {
  it("POST returns otp_reference_id and expiry for valid mobile", async () => {
    const req = makeJsonRequest(
      "https://navdhan.app/api/apply/otp/send",
      { channel: "sms", destination: "9876543210", purpose: "mobile_verification" },
      freshCookie
    );
    const res = await postOtpSend(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("otp_reference_id");
    expect(json).toHaveProperty("expires_at");
    expect(json).toHaveProperty("cooldown_seconds");
  });

  it("POST returns 400 for invalid destination", async () => {
    const req = makeJsonRequest(
      "https://navdhan.app/api/apply/otp/send",
      { channel: "sms", destination: "12345", purpose: "mobile_verification" },
      freshCookie
    );
    const res = await postOtpSend(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("INVALID_DESTINATION");
    expect(Array.isArray(json.field_errors)).toBe(true);
  });

  it("POST returns 403 when CSRF header is missing", async () => {
    const req = new Request("https://navdhan.app/api/apply/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: freshCookie },
      body: JSON.stringify({ channel: "sms", destination: "9876543210", purpose: "mobile_verification" }),
    });
    const res = await postOtpSend(req);
    expect(res.status).toBe(403);
  });
});

describe("/api/apply/otp/verify", () => {
  it("POST returns verified true and token for valid OTP", async () => {
    const req = makeJsonRequest(
      "https://navdhan.app/api/apply/otp/verify",
      {
        otp_reference_id: "11111111-1111-1111-1111-111111111111",
        otp: "123456",
        purpose: "aadhaar_verification",
      },
      freshCookie
    );
    const res = await postOtpVerify(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.verified).toBe(true);
    expect(json).toHaveProperty("verification_token");
  });

  it("POST returns 400 for short OTP", async () => {
    const req = makeJsonRequest(
      "https://navdhan.app/api/apply/otp/verify",
      {
        otp_reference_id: "11111111-1111-1111-1111-111111111111",
        otp: "12345",
        purpose: "aadhaar_verification",
      },
      freshCookie
    );
    const res = await postOtpVerify(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("INVALID_OTP");
    expect(json).toHaveProperty("remaining_attempts");
  });
});

describe("/api/apply/documents/upload-url", () => {
  it("POST returns presigned URL metadata for valid PDF", async () => {
    const req = makeJsonRequest(
      "https://navdhan.app/api/apply/documents/upload-url",
      {
        document_type: "itr",
        file_name: "itr_2024_25.pdf",
        file_size_bytes: 1024,
        mime_type: "application/pdf",
        financial_year: "2024-25",
      },
      freshCookie
    );
    const res = await postUploadUrl(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("document_id");
    expect(json).toHaveProperty("upload_url");
    expect(json).toHaveProperty("upload_method");
    expect(json).toHaveProperty("expires_at");
  });

  it("POST returns 413 when file size exceeds limit", async () => {
    const req = makeJsonRequest(
      "https://navdhan.app/api/apply/documents/upload-url",
      {
        document_type: "itr",
        file_name: "large.pdf",
        file_size_bytes: 5242881,
        mime_type: "application/pdf",
      },
      freshCookie
    );
    const res = await postUploadUrl(req);
    expect(res.status).toBe(413);
    const json = await res.json();
    expect(json.error).toBe("FILE_TOO_LARGE");
    expect(json.max_size_bytes).toBe(5242880);
  });

  it("POST returns 400 for disallowed mime type", async () => {
    const req = makeJsonRequest(
      "https://navdhan.app/api/apply/documents/upload-url",
      {
        document_type: "itr",
        file_name: "itr.png",
        file_size_bytes: 1024,
        mime_type: "image/png",
      },
      freshCookie
    );
    const res = await postUploadUrl(req);
    expect(res.status).toBe(400);
  });
});

describe("/api/apply/documents/upload", () => {
  it("POST returns 201 for valid base64 PDF", async () => {
    const req = makeJsonRequest(
      "https://navdhan.app/api/apply/documents/upload",
      {
        document_type: "itr",
        file_name: "itr_2024_25.pdf",
        mime_type: "application/pdf",
        base64_content:
          "JVBERi0xLjcgCiXi48/TIAoxIDAgb2JqIDw8IC9UeXBlIC9DYXRhbG9nIC9QYWdlcyAyIDAgUiA+PiBlbmRvYmogMiAwIG9iaiA8PCAvVHlwZSAvUGFnZXMgL0tpZHMgWzMgMCBSXSAvQ291bnQgMSA+PiBlbmRvYmogMyAwIG9iaiA8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDIgMCBSIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDQgMCBSID4+ID4+IC9Db250ZW50cyA1IDAgUiA+PiBlbmRvYmogNCAwIG9iaiA8PCAvVHlwZSAvRm9udCAvU3VidHlwZSAvVHlwZTEgL0Jhc2VGb250IC9IZWx2ZXRpY2EgPj4gZW5kb2JqIDUgMCBvYmogPDwgL0xlbmd0aCA0NCA+PiBzdHJlYW0gQlQgL0YxIDE4IFRmIDcyIDcyMCBUZCAoVGVzdCBQREYpIFRqIEVUIcGrChcgZW5kc3RyZWFtIGVuZG9iaiB4cmVmIDAgNiAwMDAwMDAwMDAwIDY1NTM1IGYgIDAwMDAwMDA2MzAgMDAwMDAgbiAgMDAwMDAwMDczMiAwMDAwMCBuICAwMDAwMDAwODIxIDAwMDAwIG4gIDAwMDAwMDA5MTkgMDAwMDAgbiAgMDAwMDAwMTAyMSAwMDAwMCBuICAwMDAwMDAxMTI5IDAwMDAwIG4gIHRyYWlsZXIgPDwgL1NpemUgNiAvUm9vdCAxIDAgUiA+Pg==",
      },
      freshCookie
    );
    const res = await postUploadDocument(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json).toHaveProperty("document_id");
  });

  it("POST returns 415 for non-PDF mime type", async () => {
    const req = makeJsonRequest(
      "https://navdhan.app/api/apply/documents/upload",
      {
        document_type: "itr",
        file_name: "itr.png",
        mime_type: "image/png",
        base64_content: "iVBORw0KGgo=",
      },
      freshCookie
    );
    const res = await postUploadDocument(req);
    expect(res.status).toBe(415);
    const json = await res.json();
    expect(json.error).toBe("UNSUPPORTED_MEDIA_TYPE");
  });
});

describe("/api/apply/perfios", () => {
  it("initiate returns transaction id and redirect_url when consent accepted", async () => {
    const req = makeJsonRequest(
      "https://navdhan.app/api/apply/perfios/initiate",
      { months_requested: 12, preferred_bank: "HDFC Bank", consent_accepted: true },
      freshCookie
    );
    const res = await postPerfiosInitiate(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("perfios_transaction_id");
    expect(json).toHaveProperty("redirect_url");
    expect(json).toHaveProperty("expires_at");
  });

  it("initiate returns 400 when consent_accepted is false", async () => {
    const req = makeJsonRequest(
      "https://navdhan.app/api/apply/perfios/initiate",
      { months_requested: 12, consent_accepted: false },
      freshCookie
    );
    const res = await postPerfiosInitiate(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("VALIDATION_ERROR");
  });

  it("callback returns 204 for valid stub callback", async () => {
    const req = makeJsonRequest(
      "https://navdhan.app/api/apply/perfios/callback",
      {
        perfios_transaction_id: "txn_123",
        status: "success",
        statement_count: 12,
        month_count: 12,
      },
      freshCookie
    );
    const res = await postPerfiosCallback(req);
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });

  it("status returns current perfios transaction status", async () => {
    const req = makeGetRequest(
      "https://navdhan.app/api/apply/perfios/status?perfios_transaction_id=txn_123",
      freshCookie
    );
    const res = await getPerfiosStatus(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("perfios_transaction_id");
    expect(json).toHaveProperty("status");
  });
});

describe("/api/apply/submit", () => {
  it("POST returns reference_number on successful submission", async () => {
    const req = makeJsonRequest(
      "https://navdhan.app/api/apply/submit",
      {
        application_id: "11111111-1111-1111-1111-111111111111",
        final_consents: {
          terms: true,
          privacy: true,
          credit_bureau: true,
          marketing: false,
        },
      },
      freshCookie
    );
    const res = await postSubmit(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.outcome).toBe("submitted_success");
    expect(json.reference_number).toMatch(/^NDH-\d{8}-[A-Z0-9]{6}$/);
    expect(json.next_step).toBe("offers");
  });

  it("POST returns 400 for missing consents", async () => {
    const req = makeJsonRequest(
      "https://navdhan.app/api/apply/submit",
      {
        application_id: "11111111-1111-1111-1111-111111111111",
        final_consents: {
          terms: true,
          privacy: false,
          credit_bureau: false,
          marketing: false,
        },
      },
      freshCookie
    );
    const res = await postSubmit(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("VALIDATION_ERROR");
    expect(Array.isArray(json.missing_consents)).toBe(true);
  });

  it("POST returns 422 when step data is incomplete", async () => {
    const req = makeJsonRequest(
      "https://navdhan.app/api/apply/submit",
      {
        application_id: "22222222-2222-2222-2222-222222222222",
        final_consents: {
          terms: true,
          privacy: true,
          credit_bureau: true,
          marketing: true,
        },
      },
      freshCookie
    );
    const res = await postSubmit(req);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe("INCOMPLETE_APPLICATION");
  });

  it("POST returns 500 support payload on submission failure", async () => {
    const req = makeJsonRequest(
      "https://navdhan.app/api/apply/submit",
      {
        application_id: "deadbeef-dead-dead-dead-deadbeefdead",
        final_consents: {
          terms: true,
          privacy: true,
          credit_bureau: true,
          marketing: true,
        },
      },
      freshCookie
    );
    const res = await postSubmit(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("SUBMISSION_FAILED");
    expect(json).toHaveProperty("support_reference");
    expect(["email", "phone", "chat_stub"]).toContain(json.support_path);
  });
});

describe("/api/apply/offers", () => {
  it("GET returns an array of lender offers", async () => {
    const req = makeGetRequest(
      "https://navdhan.app/api/apply/offers?application_id=11111111-1111-1111-1111-111111111111",
      freshCookie
    );
    const res = await getOffers(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.offers)).toBe(true);
    if (json.offers.length > 0) {
      const offer = json.offers[0];
      expect(offer).toHaveProperty("offer_id");
      expect(offer).toHaveProperty("lender_name");
      expect(offer).toHaveProperty("interest_rate_annual");
    }
  });

  it("GET returns 404 for unsubmitted or missing application", async () => {
    const req = makeGetRequest(
      "https://navdhan.app/api/apply/offers?application_id=00000000-0000-0000-0000-000000000000",
      freshCookie
    );
    const res = await getOffers(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("APPLICATION_NOT_FOUND");
  });
});

describe("/api/apply/consent", () => {
  it("POST records consent and returns ConsentRecord", async () => {
    const req = makeJsonRequest(
      "https://navdhan.app/api/apply/consent",
      {
        application_id: "11111111-1111-1111-1111-111111111111",
        step_id: "aadhaar_verification",
        consent_key: "apply.consent.aadhaarPurpose",
        accepted: true,
        locale: "en",
        statement_snapshot: "I consent to Aadhaar based verification.",
      },
      freshCookie
    );
    const res = await postConsent(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json).toHaveProperty("consent_id");
    expect(json.application_id).toBe("11111111-1111-1111-1111-111111111111");
    expect(json.step_id).toBe("aadhaar_verification");
    expect(json.accepted).toBe(true);
  });

  it("POST returns 400 for missing statement_snapshot", async () => {
    const req = makeJsonRequest(
      "https://navdhan.app/api/apply/consent",
      {
        application_id: "11111111-1111-1111-1111-111111111111",
        step_id: "aadhaar_verification",
        consent_key: "apply.consent.aadhaarPurpose",
        accepted: true,
      },
      freshCookie
    );
    const res = await postConsent(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("VALIDATION_ERROR");
    const fields = json.field_errors.map((e: { field: string }) => e.field);
    expect(fields).toContain("statement_snapshot");
  });
});
