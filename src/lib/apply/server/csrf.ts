/**
 * CSRF protection for mutating routes.
 */

const CSRF_HEADER_NAME = "x-navdhan-requested-with";
const CSRF_HEADER_VALUE = "apply";

export function isValidCsrfHeader(request: Request): boolean {
  const header = request.headers.get(CSRF_HEADER_NAME);
  return header === CSRF_HEADER_VALUE;
}
