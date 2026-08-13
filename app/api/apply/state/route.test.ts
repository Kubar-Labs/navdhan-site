import { beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/apply/state/route";
import {
  applicationsById,
  applicationsBySession,
  applicantsByApplicationId,
  consentsByApplicationId,
  documentsById,
  offersByApplicationId,
  otpAttemptsByReference,
  perfiosTransactions,
} from "@/src/lib/apply/server/store";

const cookie = (sessionId: string) => `__Host-nd_session=${sessionId}`;

describe("GET /api/apply/state application ownership", () => {
  beforeEach(() => {
    applicationsById.clear();
    applicationsBySession.clear();
    applicantsByApplicationId.clear();
    documentsById.clear();
    consentsByApplicationId.clear();
    perfiosTransactions.clear();
    otpAttemptsByReference.clear();
    offersByApplicationId.clear();
  });

  it("rejects a caller application ID owned by another browser session", async () => {
    const ownerResponse = await GET(
      new Request("http://localhost/api/apply/state", {
        headers: { cookie: cookie("owner-session") },
      }),
    );
    const ownerBody = (await ownerResponse.json()) as { application_id: string };

    const attackerResponse = await GET(
      new Request(
        `http://localhost/api/apply/state?application_id=${ownerBody.application_id}`,
        { headers: { cookie: cookie("different-session") } },
      ),
    );

    expect(attackerResponse.status).toBe(404);
    await expect(attackerResponse.json()).resolves.toEqual({
      error: "APPLICATION_NOT_FOUND",
    });
    expect(applicationsById.get(ownerBody.application_id)?.sessionId).toBe(
      "owner-session",
    );
    expect(applicationsBySession.has("different-session")).toBe(false);
  });

  it("rejects a cross-session update without changing application ownership", async () => {
    const ownerResponse = await GET(
      new Request("http://localhost/api/apply/state", {
        headers: { cookie: cookie("owner-session") },
      }),
    );
    const ownerBody = (await ownerResponse.json()) as { application_id: string };

    const attackerResponse = await POST(
      new Request("http://localhost/api/apply/state", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: cookie("different-session"),
          "x-navdhan-requested-with": "apply",
        },
        body: JSON.stringify({
          application_id: ownerBody.application_id,
          current_step: "loan_intent",
          payload: {
            loan_amount: 500000,
            tenure_months: 24,
            purpose: "working_capital",
          },
        }),
      }),
    );

    expect(attackerResponse.status).toBe(404);
    expect(applicationsById.get(ownerBody.application_id)?.sessionId).toBe(
      "owner-session",
    );
    expect(applicationsBySession.has("different-session")).toBe(false);
  });
});
