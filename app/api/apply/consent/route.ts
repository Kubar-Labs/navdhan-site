/**
 * Consent recording handler for application steps.
 */

import { randomUUID } from "crypto";
import {
  gateRequest,
  readJsonBody,
  jsonResponse,
  validationErrorResponse,
} from "@/app/api/apply/lib/helpers";
import { addConsent } from "@/src/lib/apply/server/store";
import { hashSessionId } from "@/src/lib/apply/server/session";
import { type ConsentRecord } from "@/src/types/apply";

export async function POST(request: Request): Promise<Response> {
  const gate = await gateRequest(request);
  if (!gate.ok) return gate.response;

  const body = await readJsonBody(request);
  if (!body) {
    return jsonResponse({ error: "BAD_REQUEST", message: "Invalid JSON body" }, 400);
  }

  const applicationId = typeof body.application_id === "string" ? body.application_id : "";
  const stepId = typeof body.step_id === "string" ? body.step_id : "";
  const consentKey = typeof body.consent_key === "string" ? body.consent_key : "";
  const accepted = body.accepted === true;
  const locale = typeof body.locale === "string" ? body.locale : "en";
  const statementSnapshot =
    typeof body.statement_snapshot === "string" ? body.statement_snapshot : "";

  if (!statementSnapshot) {
    return validationErrorResponse([
      { field: "statement_snapshot", message_i18n_key: "apply.errors.consentRequired" },
    ]);
  }

  const userAgent = request.headers.get("user-agent") ?? "";

  const consent: ConsentRecord = {
    consentId: randomUUID(),
    applicationId,
    stepId,
    consentKey,
    accepted,
    statementSnapshot,
    locale,
    clientIpHash: hashSessionId(gate.sessionId),
    userAgentHash: userAgent ? hashSessionId(userAgent) : null,
    recordedAt: new Date().toISOString(),
  };

  addConsent(consent);

  return jsonResponse(
    {
      consent_id: consent.consentId,
      application_id: consent.applicationId,
      step_id: consent.stepId,
      consent_key: consent.consentKey,
      accepted: consent.accepted,
      statement_snapshot: consent.statementSnapshot,
      recorded_at: consent.recordedAt,
      locale: consent.locale,
    },
    201,
  );
}
