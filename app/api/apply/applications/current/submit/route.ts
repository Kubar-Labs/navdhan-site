import { validateSubmitApplication } from "@/app/apply/lib/validation";
import { proxyCollectionWrite } from "@/src/lib/apply/server/collection-proxy";

export function POST(request: Request): Promise<Response> {
  return proxyCollectionWrite(
    request,
    "/api/apply/applications/current/submit",
    validateSubmitApplication,
    "POST",
  );
}
