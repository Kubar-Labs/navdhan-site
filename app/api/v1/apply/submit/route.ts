import {
  checkIdempotencyKey,
  storeIdempotencyKey,
  validatePostPayload,
} from "@/src/lib/apply/server/idempotency.stub";
import { submitApplication } from "@/src/lib/apply/server/submit-application.stub";

function getIdempotencyKey(request: Request): string | undefined {
  return request.headers.get("Idempotency-Key") ?? undefined;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "BAD_REQUEST", message: "Invalid JSON body" }, 400);
  }

  const key =
    typeof body.idempotencyKey === "string" ? body.idempotencyKey : getIdempotencyKey(request);

  if (!key) {
    return jsonResponse(
      { error: "IDEMPOTENCY_KEY_REQUIRED", message: "Idempotency key is required" },
      400,
    );
  }

  const duplicate = await checkIdempotencyKey({ key });
  if (duplicate.status === "duplicate") {
    return jsonResponse(
      {
        error: "CONFLICT",
        existing_reference: duplicate.existingReference,
        message: "Idempotency key already used",
      },
      409,
    );
  }

  const payload = body.payload ?? body;
  const validation = validatePostPayload(payload);
  if (!validation.valid) {
    return jsonResponse({ error: "VALIDATION_ERROR", errors: validation.errors }, 422);
  }

  const result = await submitApplication({ payload, idempotencyKey: key });
  return jsonResponse(result, 201);
}
