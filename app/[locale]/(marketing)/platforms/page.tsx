import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PartnerMarketingPage } from "@/src/components/marketing/NavDhanMarketingPage";
import { isValidLocale } from "@/src/lib/i18n/config";

export const metadata: Metadata = {
  title: "For Platforms | NavDhan",
  description: "Give your business customers a clear path to financing with NavDhan.",
};

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  return <PartnerMarketingPage locale={locale} audience="platform" />;
}
