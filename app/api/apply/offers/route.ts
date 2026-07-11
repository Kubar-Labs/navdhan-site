/**
 * Lender offers retrieval handler.
 */

import { randomUUID } from "crypto";
import { gateGetRequest, jsonResponse } from "@/app/api/apply/lib/helpers";

export async function GET(request: Request): Promise<Response> {
  const gate = await gateGetRequest(request);
  if (!gate.ok) return gate.response;

  const url = new URL(request.url);
  const applicationId = url.searchParams.get("application_id") ?? "";

  if (applicationId === "00000000-0000-0000-0000-000000000000") {
    return jsonResponse({ error: "APPLICATION_NOT_FOUND" }, 404);
  }

  return jsonResponse({
    offers: [
      {
        offer_id: randomUUID(),
        lender_name: "Test Lender",
        interest_rate_annual: 18,
      },
    ],
  });
}
