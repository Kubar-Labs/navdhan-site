import { createNavigation } from "next-intl/navigation";
import { defaultLocale, locales } from "@/src/lib/i18n/config";

export const routing = {
  locales,
  defaultLocale,
  localePrefix: "always" as const,
};

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
