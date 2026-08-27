import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PartnerMarketingPage } from "@/src/components/marketing/NavDhanMarketingPage";
import { isValidLocale } from "@/src/lib/i18n/config";
import { localizedAlternates } from "@/src/lib/i18n/metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const title = "For Platforms | NavDhan";
  const description = "Give your business customers a clear path to financing with NavDhan.";
  return {
    title,
    description,
    alternates: localizedAlternates(locale, "/platforms"),
    openGraph: { title, description, url: `/${locale}/platforms` },
    twitter: { title, description },
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  return <PartnerMarketingPage locale={locale} audience="platform" />;
}
