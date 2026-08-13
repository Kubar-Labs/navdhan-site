import { validationErrorResponse } from "@/src/lib/apply/server/errors";
import { isSafePartyId } from "@/src/lib/apply/server/collection-proxy";

export function partyPath(partyId: string, suffix = ""): string | null {
  if (!isSafePartyId(partyId)) return null;
  return `/api/apply/applications/current/parties/${partyId}${suffix}`;
}

export function invalidPartyResponse(): Response {
  return validationErrorResponse([
    { field: "party_id", message_i18n_key: "apply.errors.invalidPartyId" },
  ]);
}
