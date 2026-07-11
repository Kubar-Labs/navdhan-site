import { randomUUID } from "crypto";
import {
  gateRequest,
  readJsonBody,
  jsonResponse,
  validationErrorResponse,
  MAX_FILE_SIZE_BYTES,
} from "@/app/api/apply/lib/helpers";
import { expiryFromNow } from "@/src/lib/apply/server/store";

const ALLOWED_MIME_TYPES = ["application/pdf"];

export async function POST(request: Request): Promise<Response> {
  const gate = await gateRequest(request);
  if (!gate.ok) return gate.response;

  const body = await readJsonBody(request);
  if (!body) {
    return jsonResponse({ error: "BAD_REQUEST", message: "Invalid JSON body" }, 400);
  }

  const fileSizeBytes = typeof body.file_size_bytes === "number" ? body.file_size_bytes : NaN;
  const mimeType = typeof body.mime_type === "string" ? body.mime_type : "";
  const fileName = typeof body.file_name === "string" ? body.file_name : "";

  if (Number.isNaN(fileSizeBytes) || fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    return jsonResponse(
      {
        error: "FILE_TOO_LARGE",
        message: "File exceeds maximum size",
        max_size_bytes: MAX_FILE_SIZE_BYTES,
      },
      413,
    );
  }

  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return validationErrorResponse(
      [{ field: "mime_type", message_i18n_key: "apply.errors.invalidMimeType" }],
      { error: "UNSUPPORTED_MEDIA_TYPE" },
    );
  }

  const documentId = randomUUID();
  const uploadUrl = `https://storage.navdhan.app/apply/uploads/${documentId}/${encodeURIComponent(fileName)}`;

  return jsonResponse({
    document_id: documentId,
    upload_url: uploadUrl,
    upload_method: "PUT",
    expires_at: expiryFromNow(15),
  });
}
