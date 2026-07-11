import { randomUUID } from "crypto";
import {
  gateRequest,
  readJsonBody,
  jsonResponse,
  validationErrorResponse,
} from "@/app/api/apply/lib/helpers";
import { addPerfiosTransaction, expiryFromNow } from "@/src/lib/apply/server/store";
import { type PerfiosTransaction } from "@/src/types/apply";

function isValidMonthsRequested(value: unknown): boolean {
  if (!Number.isInteger(value)) return false;
  const n = Number(value);
  return n >= 6 && n <= 12;
}

export async function POST(request: Request): Promise<Response> {
  const gate = await gateRequest(request);
  if (!gate.ok) return gate.response;

  const body = await readJsonBody(request);
  if (!body) {
    return jsonResponse({ error: "BAD_REQUEST", message: "Invalid JSON body" }, 400);
  }

  const errors: { field: string; message_i18n_key: string }[] = [];
  if (!isValidMonthsRequested(body.months_requested)) {
    errors.push({ field: "months_requested", message_i18n_key: "apply.errors.invalidMonths" });
  }
  if (body.consent_accepted !== true) {
    errors.push({ field: "consent_accepted", message_i18n_key: "apply.errors.consentRequired" });
  }
  if (errors.length > 0) {
    return validationErrorResponse(errors);
  }

  const perfiosTransactionId = `perfios-${randomUUID()}`;
  const expiresAt = expiryFromNow(30);
  const txn: PerfiosTransaction = {
    perfiosTransactionId,
    applicationId: gate.application.id,
    status: "pending",
    statementCount: null,
    monthCount: null,
    failureReason: null,
    expiresAt,
    createdAt: new Date().toISOString(),
  };
  addPerfiosTransaction(txn);

  return jsonResponse({
    perfios_transaction_id: perfiosTransactionId,
    redirect_url: "https://perfios.navdhan.app/stub",
    expires_at: expiresAt,
  });
}
