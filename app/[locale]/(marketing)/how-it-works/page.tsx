import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HowItWorksPage } from "@/src/components/marketing/InformationalPages";
import { isValidLocale } from "@/src/lib/i18n/config";
import { localizedAlternates } from "@/src/lib/i18n/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const title = "How It Works | NavDhan";
  const description =
    "See the steps in the NavDhan application and what happens after you submit it for lender review.";
  return {
    title,
    description,
    alternates: localizedAlternates(locale, "/how-it-works"),
    openGraph: { title, description, url: `/${locale}/how-it-works` },
    twitter: { title, description },
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  return <HowItWorksPage locale={locale} />;
}
