import { randomUUID } from "crypto";
import {
  gateRequest,
  readJsonBody,
  jsonResponse,
  validationErrorResponse,
  MAX_FILE_SIZE_BYTES,
} from "@/app/api/apply/lib/helpers";
import { addDocument } from "@/src/lib/apply/server/store";
import { type DocumentRecord } from "@/src/types/apply";

const ALLOWED_MIME_TYPES = ["application/pdf"];
const ALLOWED_DOCUMENT_TYPES = ["itr", "tds_certificate"];

export async function POST(request: Request): Promise<Response> {
  const gate = await gateRequest(request);
  if (!gate.ok) return gate.response;

  const body = await readJsonBody(request);
  if (!body) {
    return jsonResponse({ error: "BAD_REQUEST", message: "Invalid JSON body" }, 400);
  }

  const documentType = typeof body.document_type === "string" ? body.document_type : "";
  const fileName = typeof body.file_name === "string" ? body.file_name : "";
  const mimeType = typeof body.mime_type === "string" ? body.mime_type : "";

  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return jsonResponse(
      { error: "UNSUPPORTED_MEDIA_TYPE", message: "Only PDF uploads are supported" },
      415,
    );
  }

  if (!ALLOWED_DOCUMENT_TYPES.includes(documentType)) {
    return validationErrorResponse([
      { field: "document_type", message_i18n_key: "apply.errors.invalidDocumentType" },
    ]);
  }

  const base64Content = typeof body.base64_content === "string" ? body.base64_content : "";
  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64Content, "base64");
  } catch {
    return validationErrorResponse([
      { field: "base64_content", message_i18n_key: "apply.errors.invalidBase64" },
    ]);
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return jsonResponse(
      {
        error: "FILE_TOO_LARGE",
        message: "File exceeds maximum size",
        max_size_bytes: MAX_FILE_SIZE_BYTES,
      },
      413,
    );
  }

  const now = new Date().toISOString();
  const doc: DocumentRecord = {
    id: randomUUID(),
    applicationId: gate.application.id,
    documentType: documentType as DocumentRecord["documentType"],
    fileName,
    mimeType,
    storagePath: `navdhan/apply/${gate.application.id}/${randomUUID()}.pdf`,
    fileSizeBytes: buffer.length,
    status: "uploaded",
    scanResult: null,
    financialYear: typeof body.financial_year === "string" ? body.financial_year : null,
    createdAt: now,
    updatedAt: now,
  };
  addDocument(doc);

  return jsonResponse(
    {
      document_id: doc.id,
      document_type: doc.documentType,
      file_name: doc.fileName,
      mime_type: doc.mimeType,
      file_size_bytes: doc.fileSizeBytes,
      status: doc.status,
      uploaded_at: doc.createdAt,
    },
    201,
  );
}
