import { randomUUID } from "crypto";
import { gateRequest, readJsonBody, jsonResponse } from "@/app/api/apply/lib/helpers";
import { getOtpAttempt, addOtpAttempt } from "@/src/lib/apply/server/store";

const MAX_OTP_ATTEMPTS = 3;

export async function POST(request: Request): Promise<Response> {
  const gate = await gateRequest(request);
  if (!gate.ok) return gate.response;

  const body = await readJsonBody(request);
  if (!body) {
    return jsonResponse({ error: "BAD_REQUEST", message: "Invalid JSON body" }, 400);
  }

  const otp = body.otp;
  if (typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
    return jsonResponse(
      {
        error: "INVALID_OTP",
        message: "OTP must be 6 digits",
        remaining_attempts: MAX_OTP_ATTEMPTS - 1,
      },
      400,
    );
  }

  const referenceId = typeof body.otp_reference_id === "string" ? body.otp_reference_id : "";
  if (!referenceId) {
    return jsonResponse({ error: "INVALID_REFERENCE", message: "Missing reference id" }, 400);
  }

  let attempt = getOtpAttempt(referenceId);
  if (!attempt) {
    // In the stub environment any well-formed OTP reference validates.
    attempt = {
      otpReferenceId: referenceId,
      applicationId: gate.application.id,
      channel: "sms",
      destinationHash: "",
      purpose:
        body.purpose === "aadhaar_verification" ? "aadhaar_verification" : "mobile_verification",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      verified: false,
      attemptCount: 0,
    };
    addOtpAttempt(attempt);
  }

  attempt.attemptCount += 1;
  const remaining = Math.max(0, MAX_OTP_ATTEMPTS - attempt.attemptCount);

  if (attempt.attemptCount > MAX_OTP_ATTEMPTS) {
    return jsonResponse(
      { error: "OTP_EXPIRED", message: "Too many attempts", remaining_attempts: 0 },
      400,
    );
  }

  attempt.verified = true;

  return jsonResponse({
    verified: true,
    verification_token: randomUUID(),
  });
}
