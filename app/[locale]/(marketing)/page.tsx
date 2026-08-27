import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HomeMarketingPage } from "@/src/components/marketing/NavDhanMarketingPage";
import { isValidLocale } from "@/src/lib/i18n/config";
import { getTranslator } from "@/src/lib/i18n/translations";

export const metadata: Metadata = {
  title: "Business financing, made simple | NavDhan",
  description: "Apply once, share your details securely, and continue to financing options from NavDhan lending partners.",
};

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const t = await getTranslator(locale);
  const heroCopy = locale === "en"
    ? undefined
    : {
        eyebrow: t("home.hero.eyebrow"),
        title: t("home.hero.headline"),
        body: t("home.hero.body"),
        primary: t("home.hero.primaryCta"),
        secondary: t("home.hero.secondaryCta"),
      };
  return <HomeMarketingPage locale={locale} heroCopy={heroCopy} />;
}
