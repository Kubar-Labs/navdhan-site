import { validateParty } from "@/app/apply/lib/validation";
import { proxyCollectionWrite } from "@/src/lib/apply/server/collection-proxy";

export function POST(request: Request): Promise<Response> {
  return proxyCollectionWrite(
    request,
    "/api/apply/applications/current/parties",
    validateParty,
    "POST",
  );
}
