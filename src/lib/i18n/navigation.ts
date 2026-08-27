import { defaultLocale, isValidLocale, type Locale } from "./config";

export function localizedUrl(
  pathname: string,
  nextLocale: Locale,
  search = "",
  hash = "",
): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length > 0 && isValidLocale(segments[0])) {
    segments[0] = nextLocale;
  } else {
    segments.unshift(nextLocale || defaultLocale);
  }
  return `/${segments.join("/")}${search}${hash}`;
}
