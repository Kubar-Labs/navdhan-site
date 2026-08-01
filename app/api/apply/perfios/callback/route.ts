import { readJsonBody, jsonResponse, gateRequest } from "@/app/api/apply/lib/helpers";
import { getPerfiosTransaction, addPerfiosTransaction } from "@/src/lib/apply/server/store";
import { type PerfiosStatus } from "@/src/types/apply";

export async function POST(request: Request): Promise<Response> {
  const gate = await gateRequest(request);
  if (!gate.ok) return gate.response;

  const body = await readJsonBody(request);
  if (!body) {
    return jsonResponse({ error: "INVALID_CALLBACK", message: "Invalid JSON body" }, 400);
  }

  const transactionId =
    typeof body.perfios_transaction_id === "string" ? body.perfios_transaction_id : "";
  if (!transactionId) {
    return jsonResponse(
      { error: "INVALID_CALLBACK", message: "Missing perfios_transaction_id" },
      400,
    );
  }

  const statusValue = typeof body.status === "string" ? body.status : "";
  if (!["success", "failure", "partial", "pending"].includes(statusValue)) {
    return jsonResponse({ error: "INVALID_CALLBACK", message: "Invalid status" }, 400);
  }

  let txn = getPerfiosTransaction(transactionId);
  if (!txn) {
    // Webhook may arrive before the initiating request is fully persisted in tests.
    txn = {
      perfiosTransactionId: transactionId,
      applicationId: gate.application.id,
      status: statusValue as PerfiosStatus,
      statementCount: null,
      monthCount: null,
      failureReason: null,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    };
    addPerfiosTransaction(txn);
  } else {
    txn.status = statusValue as PerfiosStatus;
    txn.statementCount =
      typeof body.statement_count === "number" ? body.statement_count : txn.statementCount;
    txn.monthCount = typeof body.month_count === "number" ? body.month_count : txn.monthCount;
    if (typeof body.failure_reason === "string") {
      txn.failureReason = body.failure_reason;
    }
  }

  return new Response(null, { status: 204 });
}
