import { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  hasPublishedLegalContent,
  loadLegalPage,
  legalSlugs,
  publishedLegalLocales,
  type LegalSlug,
} from "@/src/lib/legal/loader";
import { LegalPageShell } from "@/src/components/legal/LegalPageShell";
import { isValidLocale } from "@/src/lib/i18n/config";
import { localizedAlternates } from "@/src/lib/i18n/metadata";

interface LegalPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: LegalPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isValidLocale(locale)) notFound();
  try {
    const page = await loadLegalPage(locale, slug);
    return {
      title: page.meta.title,
      description: page.meta.description,
      alternates: localizedAlternates(locale, `/legal/${slug}`, publishedLegalLocales),
      robots: hasPublishedLegalContent(locale)
        ? undefined
        : {
            index: false,
            follow: true,
            googleBot: { index: false, follow: true },
          },
    };
  } catch {
    return { title: "Legal | NavDhan" };
  }
}

export default async function LegalPage({ params }: LegalPageProps) {
  const { locale, slug } = await params;
  const page = await loadLegalPage(locale, slug);

  return <LegalPageShell page={page} locale={locale} slug={slug} />;
}

export function generateStaticParams() {
  const params: { locale: string; slug: LegalSlug }[] = [];
  const locales = ["en", "hi", "bn", "te", "mr", "ta", "kn", "ml"];
  for (const locale of locales) {
    for (const slug of legalSlugs) {
      params.push({ locale, slug });
    }
  }
  return params;
}
