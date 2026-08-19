import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Container } from "@/src/components/layout/Container";
import { ApplyWizard, type ApplyMessages } from "@/src/components/apply/ApplyWizard";
import { getMessages } from "@/src/lib/i18n/messages";
import { isValidLocale } from "@/src/lib/i18n/config";
import { localizedAlternates } from "@/src/lib/i18n/metadata";
import { getTranslator } from "@/src/lib/i18n/translations";

interface ApplyPageProps {
  params: Promise<{ locale: string }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function generateMetadata({ params }: ApplyPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const t = await getTranslator(locale, "apply.meta");
  return {
    title: t("title"),
    description: t("description"),
    alternates: localizedAlternates(locale, "/apply"),
    robots: {
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    },
  };
}

export default async function ApplyPage({ params }: ApplyPageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) {
    notFound();
  }

  const messages = getMessages(locale);
  const tGlobal = await getTranslator(locale, "global");
  const applyMessages: ApplyMessages = {
    ...(isRecord(messages.apply) ? (messages.apply as ApplyMessages) : {}),
    viewDashboardLabel: tGlobal("cta.backToHome"),
  };

  return (
    <Container className="py-12 md:py-20">
      <ApplyWizard locale={locale} messages={applyMessages} />
    </Container>
  );
}
