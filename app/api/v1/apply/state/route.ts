import { checkIdempotencyKey } from "@/src/lib/apply/server/idempotency.stub";
import { initializeApplication } from "@/src/lib/apply/server/initialize-application.stub";

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
  const key = getIdempotencyKey(request);
  if (!key) {
    return jsonResponse(
      { error: "IDEMPOTENCY_KEY_REQUIRED", message: "Idempotency-Key header is required" },
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

  const result = await initializeApplication({ idempotencyKey: key });
  return jsonResponse(result, 201);
}
