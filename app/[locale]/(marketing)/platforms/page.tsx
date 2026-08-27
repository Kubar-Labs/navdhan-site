import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlatformLandingPage } from "@/src/components/marketing/PlatformLandingPage";
import { isValidLocale } from "@/src/lib/i18n/config";

interface PlatformsPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PlatformsPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();

  return {
    title: "NavDhan for B2B Platforms | Embedded business credit",
    description:
      "Embed structured business-credit origination inside marketplace, procurement, ERP, and trade workflows.",
  };
}

export default async function PlatformsPage({ params }: PlatformsPageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();

  return <PlatformLandingPage locale={locale} />;
}
