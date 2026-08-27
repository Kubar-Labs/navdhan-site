import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PartnerMarketingPage } from "@/src/components/marketing/NavDhanMarketingPage";
import { isValidLocale } from "@/src/lib/i18n/config";
import { localizedAlternates } from "@/src/lib/i18n/metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const title = "For Lenders | NavDhan";
  const description = "Structured origination support with lender-owned eligibility, underwriting, and decisions.";
  return {
    title,
    description,
    alternates: localizedAlternates(locale, "/lenders"),
    openGraph: { title, description, url: `/${locale}/lenders` },
    twitter: { title, description },
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  return <PartnerMarketingPage locale={locale} audience="lender" />;
}
