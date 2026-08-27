import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PartnerMarketingPage } from "@/src/components/marketing/NavDhanMarketingPage";
import { isValidLocale } from "@/src/lib/i18n/config";

export const metadata: Metadata = {
  title: "For Lenders | NavDhan",
  description: "Structured origination support with lender-owned eligibility, underwriting, and decisions.",
};

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  return <PartnerMarketingPage locale={locale} audience="lender" />;
}
