import type { MetadataRoute } from "next";
import { locales } from "@/src/lib/i18n/config";
import {
  hasPublishedLegalContent,
  legalSlugs,
} from "@/src/lib/legal/loader";

const SITE_URL = "https://navdhan.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return locales.flatMap((locale) => [
    {
      url: `${SITE_URL}/${locale}`,
      changeFrequency: "weekly" as const,
      priority: locale === "en" ? 1 : 0.9,
    },
    {
      url: `${SITE_URL}/${locale}/team`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/${locale}/platforms`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/${locale}/lenders`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    ...(hasPublishedLegalContent(locale)
      ? legalSlugs.map((slug) => ({
          url: `${SITE_URL}/${locale}/legal/${slug}`,
          changeFrequency: "yearly" as const,
          priority: 0.3,
        }))
      : []),
  ]);
}
