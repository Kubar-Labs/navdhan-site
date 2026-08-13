import { validatePerson } from "@/app/apply/lib/validation";
import { proxyCollectionWrite } from "@/src/lib/apply/server/collection-proxy";

export function PUT(request: Request): Promise<Response> {
  return proxyCollectionWrite(
    request,
    "/api/apply/applications/current/primary-person",
    validatePerson,
  );
}
