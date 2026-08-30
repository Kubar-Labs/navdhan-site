import { TeamPage as TeamPageContent } from "@/src/components/marketing/TeamPage";
import { getTranslator } from "@/src/lib/i18n/translations";
import { isValidLocale } from "@/src/lib/i18n/config";
import { localizedAlternates } from "@/src/lib/i18n/metadata";
import { notFound } from "next/navigation";

interface TeamPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: TeamPageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const t = await getTranslator(locale, "team.meta");
  return {
    title: t("title"),
    description: t("description"),
    alternates: localizedAlternates(locale, "/team"),
  };
}

export default async function TeamPage({ params }: TeamPageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  return <TeamPageContent locale={locale} />;
}
