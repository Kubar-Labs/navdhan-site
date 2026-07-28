import { gateGetRequest, jsonResponse } from "@/app/api/apply/lib/helpers";
import { getPerfiosTransaction, addPerfiosTransaction } from "@/src/lib/apply/server/store";
import { type PerfiosTransaction } from "@/src/types/apply";

export async function GET(request: Request): Promise<Response> {
  const gate = await gateGetRequest(request);
  if (!gate.ok) return gate.response;

  const url = new URL(request.url);
  const transactionId =
    url.searchParams.get("transaction_id") ?? url.searchParams.get("perfios_transaction_id") ?? "";
  if (!transactionId) {
    return jsonResponse(
      {
        error: "VALIDATION_ERROR",
        field_errors: [{ field: "transaction_id", message_i18n_key: "apply.errors.required" }],
      },
      400,
    );
  }

  let txn = getPerfiosTransaction(transactionId);
  if (!txn) {
    txn = {
      perfiosTransactionId: transactionId,
      applicationId: gate.application.id,
      status: "pending",
      statementCount: null,
      monthCount: null,
      failureReason: null,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    };
    addPerfiosTransaction(txn);
  }

  return jsonResponse({
    perfios_transaction_id: txn.perfiosTransactionId,
    status: txn.status,
  });
}
