import {
  checkIdempotencyKey,
  getApplicationState,
  patchApplicationState,
  storeIdempotencyKey,
  validatePatchPayload,
} from "@/src/lib/apply/server/idempotency.stub";

interface RouteParams {
  reference: string;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<RouteParams> },
): Promise<Response> {
  const { reference } = await params;
  const state = await getApplicationState(reference);
  return jsonResponse(state);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<RouteParams> },
): Promise<Response> {
  const { reference } = await params;
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "BAD_REQUEST", message: "Invalid JSON body" }, 400);
  }

  const key =
    typeof body.idempotencyKey === "string"
      ? body.idempotencyKey
      : (request.headers.get("Idempotency-Key") ?? undefined);

  if (!key) {
    return jsonResponse(
      { error: "IDEMPOTENCY_KEY_REQUIRED", message: "Idempotency key is required" },
      400,
    );
  }

  const duplicate = await checkIdempotencyKey({ key });
  if (duplicate.status === "duplicate" && duplicate.existingReference !== reference) {
    return jsonResponse(
      {
        error: "CONFLICT",
        existing_reference: duplicate.existingReference,
        message: "Idempotency key already used for another reference",
      },
      409,
    );
  }

  const partialFields = Array.isArray(body.partialFields) ? (body.partialFields as string[]) : [];
  const values =
    body.values !== null && body.values !== undefined
      ? (body.values as Record<string, unknown>)
      : undefined;

  const validation = validatePatchPayload({ partialFields, values });
  if (!validation.valid) {
    return jsonResponse({ error: "VALIDATION_ERROR", errors: validation.errors }, 422);
  }

  await storeIdempotencyKey({ key, reference });
  const result = await patchApplicationState(reference, {
    idempotencyKey: key,
    partialFields,
  });

  return jsonResponse(result);
}
