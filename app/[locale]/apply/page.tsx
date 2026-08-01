import { notFound } from "next/navigation";
import { Container } from "@/src/components/layout/Container";
import { ApplyWizard, type ApplyMessages } from "@/src/components/apply/ApplyWizard";
import { getMessages } from "@/src/lib/i18n/messages";
import { isValidLocale } from "@/src/lib/i18n/config";

interface ApplyPageProps {
  params: Promise<{ locale: string }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export default async function ApplyPage({ params }: ApplyPageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) {
    notFound();
  }

  const messages = getMessages(locale);
  const applyMessages = isRecord(messages.apply) ? (messages.apply as ApplyMessages) : {};

  return (
    <Container className="py-12 md:py-20">
      <ApplyWizard locale={locale} messages={applyMessages} />
    </Container>
  );
}
