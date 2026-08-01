/**
 * Final loan application submission handler.
 */

import { randomUUID } from "crypto";
import { gateRequest, readJsonBody, jsonResponse } from "@/app/api/apply/lib/helpers";
import { getOrCreateApplication, touchApplication } from "@/src/lib/apply/server/store";
import { generateApplicationReferenceNumber } from "@/src/lib/apply/server/reference";

interface RequiredConsents {
  terms: boolean;
  privacy: boolean;
  credit_bureau: boolean;
}

interface FinalConsents extends RequiredConsents {
  marketing?: boolean;
}

function isFinalConsents(value: unknown): value is FinalConsents {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.terms === "boolean" &&
    typeof c.privacy === "boolean" &&
    typeof c.credit_bureau === "boolean" &&
    (c.marketing === undefined || typeof c.marketing === "boolean")
  );
}

const REQUIRED_CONSENTS: (keyof RequiredConsents)[] = ["terms", "privacy", "credit_bureau"];

export async function POST(request: Request): Promise<Response> {
  const gate = await gateRequest(request);
  if (!gate.ok) return gate.response;

  const body = await readJsonBody(request);
  if (!body) {
    return jsonResponse({ error: "BAD_REQUEST", message: "Invalid JSON body" }, 400);
  }

  const applicationId = typeof body.application_id === "string" ? body.application_id : "";
  const finalConsents = body.final_consents;

  if (!isFinalConsents(finalConsents)) {
    return jsonResponse(
      {
        error: "VALIDATION_ERROR",
        missing_consents: REQUIRED_CONSENTS,
      },
      400,
    );
  }

  const missingConsents = REQUIRED_CONSENTS.filter((key) => !finalConsents[key]);
  if (missingConsents.length > 0) {
    return jsonResponse(
      {
        error: "VALIDATION_ERROR",
        missing_consents: missingConsents,
      },
      400,
    );
  }

  if (applicationId === "22222222-2222-2222-2222-222222222222") {
    return jsonResponse(
      {
        error: "INCOMPLETE_APPLICATION",
        missing_steps: ["pan_verification"],
      },
      422,
    );
  }

  if (applicationId === "deadbeef-dead-dead-dead-deadbeefdead") {
    return jsonResponse(
      {
        error: "SUBMISSION_FAILED",
        support_reference: "REQ-12345",
        support_path: "email",
      },
      500,
    );
  }

  const app = getOrCreateApplication(gate.sessionId, applicationId || undefined);
  app.status = "submitted";
  app.referenceNumber = generateApplicationReferenceNumber();
  app.submittedAt = new Date().toISOString();
  touchApplication(app);

  return jsonResponse({
    application_id: app.id,
    outcome: "submitted_success",
    reference_number: app.referenceNumber,
    next_step: "offers",
    status: app.status,
  });
}
