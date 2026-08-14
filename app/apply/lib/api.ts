"use client";

import { v4 as uuidv4 } from "uuid";
import {
  type AadhaarIdentityPayload,
  type ApplySessionResponse,
  type BusinessProfilePayload,
  type CollectionWriteResponse,
  type ConsentGrantPayload,
  type ConsentStatusResponse,
  type CreditDeclarationPayload,
  type CreditFacilityPayload,
  type EntityPanPayload,
  type GstRegistrationPayload,
  type LoanIntentPayload,
  type PanIdentityPayload,
  type PartyPayload,
  type PartyUpdatePayload,
  type PersonPayload,
  type RequirementsResponse,
  type SubmitApplicationPayload,
  type SubmitApplicationResponse,
} from "./types";
import { CSRF_HEADER, CSRF_HEADER_VALUE } from "./constants";

class ApplyApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApplyApiError";
    this.status = status;
    this.code = code;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as {
      message?: string;
      code?: string;
      error?: string;
    };
    throw new ApplyApiError(
      data.message || `Request failed with status ${response.status}`,
      response.status,
      data.code ?? data.error,
    );
  }
  return (await response.json()) as T;
}

function makeHeaders(mutating = false): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    [CSRF_HEADER]: CSRF_HEADER_VALUE,
  };
  if (mutating) {
    headers["Idempotency-Key"] = uuidv4();
  }
  return headers;
}

export async function createApplySession(): Promise<ApplySessionResponse> {
  const response = await fetch("/api/apply/session", {
    method: "POST",
    headers: makeHeaders(),
    credentials: "same-origin",
  });
  return handleResponse<ApplySessionResponse>(response);
}

export async function fetchCurrentApplication(): Promise<CollectionWriteResponse> {
  const response = await fetch("/api/apply/applications/current", {
    method: "GET",
    headers: makeHeaders(),
    credentials: "same-origin",
  });
  return handleResponse<CollectionWriteResponse>(response);
}

export function saveLoanIntent(payload: LoanIntentPayload): Promise<CollectionWriteResponse> {
  return writeCollection("/api/apply/applications/current/loan-intent", payload);
}

async function writeCollection<T, R = CollectionWriteResponse>(
  path: string,
  payload: T,
  method: "POST" | "PUT" = "PUT",
): Promise<R> {
  const response = await fetch(path, {
    method,
    headers: makeHeaders(true),
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });
  return handleResponse<R>(response);
}

export function saveBusinessProfile(
  payload: BusinessProfilePayload,
): Promise<CollectionWriteResponse> {
  return writeCollection("/api/apply/applications/current/business-profile", payload);
}

export function savePrimaryPerson(payload: PersonPayload): Promise<CollectionWriteResponse> {
  return writeCollection("/api/apply/applications/current/primary-person", payload);
}

export function addApplicationParty(payload: PartyPayload): Promise<CollectionWriteResponse> {
  return writeCollection("/api/apply/applications/current/parties", payload, "POST");
}

function partyResource(partyId: string, suffix = ""): string {
  return `/api/apply/applications/current/parties/${encodeURIComponent(partyId)}${suffix}`;
}

export function updateApplicationParty(
  partyId: string,
  payload: PartyUpdatePayload,
): Promise<CollectionWriteResponse> {
  return writeCollection(partyResource(partyId), payload);
}

export function savePanIdentity(
  partyId: string,
  payload: PanIdentityPayload,
): Promise<CollectionWriteResponse> {
  return writeCollection(partyResource(partyId, "/identifiers/pan"), payload);
}

export function saveAadhaarIdentity(
  partyId: string,
  payload: AadhaarIdentityPayload,
): Promise<CollectionWriteResponse> {
  return writeCollection(partyResource(partyId, "/identifiers/aadhaar"), payload);
}

export function saveEntityPan(payload: EntityPanPayload): Promise<CollectionWriteResponse> {
  return writeCollection("/api/apply/applications/current/entity-pan", payload);
}

export function saveGstRegistration(
  payload: GstRegistrationPayload,
): Promise<CollectionWriteResponse> {
  return writeCollection("/api/apply/applications/current/gst-registration", payload);
}

export async function fetchRequirements(): Promise<RequirementsResponse> {
  const response = await fetch("/api/apply/applications/current/requirements", {
    method: "GET",
    headers: makeHeaders(),
    credentials: "same-origin",
  });
  return handleResponse<RequirementsResponse>(response);
}

export function saveCreditDeclaration(
  payload: CreditDeclarationPayload,
): Promise<RequirementsResponse> {
  return writeCollection<CreditDeclarationPayload, RequirementsResponse>(
    "/api/apply/applications/current/credit-declaration",
    payload,
  );
}

export async function fetchCreditFacilities(): Promise<RequirementsResponse> {
  const response = await fetch("/api/apply/applications/current/credit-facilities", {
    method: "GET",
    headers: makeHeaders(),
    credentials: "same-origin",
  });
  return handleResponse<RequirementsResponse>(response);
}

export function addCreditFacility(
  payload: CreditFacilityPayload,
): Promise<RequirementsResponse> {
  return writeCollection<CreditFacilityPayload, RequirementsResponse>(
    "/api/apply/applications/current/credit-facilities",
    payload,
    "POST",
  );
}

export interface UploadRequirementDocumentPayload {
  applicationRequirementId: string;
  expectedLockVersion: number;
  file: File;
  coverageFrom?: string;
  coverageTo?: string;
  supersedesDocumentId?: string;
}

export async function uploadRequirementDocument(
  payload: UploadRequirementDocumentPayload,
): Promise<RequirementsResponse> {
  const formData = new FormData();
  formData.set("file", payload.file, payload.file.name);
  formData.set("application_requirement_id", payload.applicationRequirementId);
  formData.set("expected_lock_version", String(payload.expectedLockVersion));
  if (payload.coverageFrom) formData.set("coverage_from", payload.coverageFrom);
  if (payload.coverageTo) formData.set("coverage_to", payload.coverageTo);
  if (payload.supersedesDocumentId)
    formData.set("supersedes_document_id", payload.supersedesDocumentId);

  const response = await fetch("/api/apply/applications/current/documents", {
    method: "POST",
    headers: {
      [CSRF_HEADER]: CSRF_HEADER_VALUE,
      "Idempotency-Key": uuidv4(),
    },
    credentials: "same-origin",
    body: formData,
  });
  return handleResponse<RequirementsResponse>(response);
}

export async function fetchConsentStatus(): Promise<ConsentStatusResponse> {
  const response = await fetch("/api/apply/applications/current/consent", {
    method: "GET",
    headers: makeHeaders(),
    credentials: "same-origin",
  });
  return handleResponse<ConsentStatusResponse>(response);
}

export function saveConsentGrants(
  payload: ConsentGrantPayload,
): Promise<ConsentStatusResponse> {
  return writeCollection<ConsentGrantPayload, ConsentStatusResponse>(
    "/api/apply/applications/current/consent",
    payload,
  );
}

export function submitCollectionApplication(
  payload: SubmitApplicationPayload,
): Promise<SubmitApplicationResponse> {
  return writeCollection<SubmitApplicationPayload, SubmitApplicationResponse>(
    "/api/apply/applications/current/submit",
    payload,
    "POST",
  );
}

export async function deleteRequirementDocument(
  documentId: string,
  expectedLockVersion: number,
): Promise<RequirementsResponse> {
  const response = await fetch(
    `/api/apply/applications/current/documents/${encodeURIComponent(documentId)}?expected_lock_version=${expectedLockVersion}`,
    {
      method: "DELETE",
      headers: {
        [CSRF_HEADER]: CSRF_HEADER_VALUE,
        "Idempotency-Key": uuidv4(),
      },
      credentials: "same-origin",
    },
  );
  return handleResponse<RequirementsResponse>(response);
}

export { ApplyApiError };
