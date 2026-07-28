import { randomUUID } from "crypto";
import {
  gateRequest,
  readJsonBody,
  jsonResponse,
  validationErrorResponse,
} from "@/app/api/apply/lib/helpers";
import { addOtpAttempt, expiryFromNow } from "@/src/lib/apply/server/store";
import { hashSessionId } from "@/src/lib/apply/server/session";

function isValidMobile(value: unknown): value is string {
  return typeof value === "string" && /^[6-9]\d{9}$/.test(value);
}

export async function POST(request: Request): Promise<Response> {
  const gate = await gateRequest(request);
  if (!gate.ok) return gate.response;

  const body = await readJsonBody(request);
  if (!body) {
    return jsonResponse({ error: "BAD_REQUEST", message: "Invalid JSON body" }, 400);
  }

  const { application, sessionId } = gate;
  const destination = body.destination;

  if (!isValidMobile(destination)) {
    return validationErrorResponse(
      [{ field: "destination", message_i18n_key: "apply.errors.invalidDestination" }],
      { error: "INVALID_DESTINATION" },
    );
  }

  const otpReferenceId = randomUUID();
  addOtpAttempt({
    otpReferenceId,
    applicationId: application.id,
    channel: body.channel === "aadhaar" ? "aadhaar" : "sms",
    destinationHash: hashSessionId(`otp:${destination}`),
    purpose:
      body.purpose === "aadhaar_verification" ? "aadhaar_verification" : "mobile_verification",
    expiresAt: expiryFromNow(10),
    verified: false,
    attemptCount: 0,
  });

  return jsonResponse({
    otp_reference_id: otpReferenceId,
    expires_at: expiryFromNow(10),
    cooldown_seconds: 60,
  });
}
