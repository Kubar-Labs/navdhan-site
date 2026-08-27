import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LenderLandingPage } from "@/src/components/marketing/LenderLandingPage";
import { isValidLocale } from "@/src/lib/i18n/config";

interface LendersPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: LendersPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();

  return {
    title: "NavDhan for Lenders | Lender-ready business-credit origination",
    description:
      "Source high-intent business-credit demand and receive structured applications with permissioned operating context.",
  };
}

export default async function LendersPage({ params }: LendersPageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();

  return <LenderLandingPage />;
}
