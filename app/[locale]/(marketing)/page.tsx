import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BorrowerLandingPage } from "@/src/components/marketing/BorrowerLandingPage";
import { isValidLocale } from "@/src/lib/i18n/config";

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: HomePageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();

  return {
    title: "NavDhan | Working capital for growing businesses",
    description:
      "Submit one structured business-credit application and review any available terms from regulated lender partners.",
  };
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();

  return <BorrowerLandingPage locale={locale} />;
}
