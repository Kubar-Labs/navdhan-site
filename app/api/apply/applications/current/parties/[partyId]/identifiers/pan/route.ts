import { validatePanIdentity } from "@/app/apply/lib/validation";
import { proxyCollectionWrite } from "@/src/lib/apply/server/collection-proxy";
import { invalidPartyResponse, partyPath } from "../../route-helpers";

interface RouteContext {
  params: Promise<{ partyId: string }>;
}

export async function PUT(request: Request, context: RouteContext): Promise<Response> {
  const path = partyPath((await context.params).partyId, "/identifiers/pan");
  if (!path) return invalidPartyResponse();
  return proxyCollectionWrite(request, path, validatePanIdentity);
}
