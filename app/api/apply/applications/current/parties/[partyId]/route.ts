import { validatePartyUpdate } from "@/app/apply/lib/validation";
import { proxyCollectionWrite } from "@/src/lib/apply/server/collection-proxy";
import { invalidPartyResponse, partyPath } from "./route-helpers";

interface RouteContext {
  params: Promise<{ partyId: string }>;
}

export async function PUT(request: Request, context: RouteContext): Promise<Response> {
  const path = partyPath((await context.params).partyId);
  if (!path) return invalidPartyResponse();
  return proxyCollectionWrite(request, path, validatePartyUpdate);
}
