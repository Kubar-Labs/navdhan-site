import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WhyNavDhanPage } from "@/src/components/marketing/InformationalPages";
import { isValidLocale } from "@/src/lib/i18n/config";
import { localizedAlternates } from "@/src/lib/i18n/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const title = "Why NavDhan | NavDhan";
  const description =
    "One guided application that puts your business financing requirement and supporting information in context.";
  return {
    title,
    description,
    alternates: localizedAlternates(locale, "/why-navdhan"),
    openGraph: { title, description, url: `/${locale}/why-navdhan` },
    twitter: { title, description },
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  return <WhyNavDhanPage locale={locale} />;
}
