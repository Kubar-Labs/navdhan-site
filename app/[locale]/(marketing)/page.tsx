import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import {
  Calendar,
  ChevronRight,
  FileText,
  PhoneCall,
  Scale,
  Shield,
  Zap,
} from "lucide-react";
import { Container } from "@/src/components/layout/Container";
import { Section } from "@/src/components/layout/Section";
import { FadeIn } from "@/src/components/motion/FadeIn";
import { StaggerContainer } from "@/src/components/motion/StaggerContainer";
import { EmiCalculator } from "@/src/components/sections/EmiCalculator";
import { getTranslator } from "@/src/lib/i18n/translations";
import { getMessages } from "@/src/lib/i18n/messages";
import { emiDefaults } from "@/src/lib/data/siteData";
import { isValidLocale } from "@/src/lib/i18n/config";
import { localizedAlternates } from "@/src/lib/i18n/metadata";
import { notFound } from "next/navigation";

const HERO_IMAGE_URL = "/assets/home/business-owner.webp";

const TERM_LOAN_IMAGE_URL = "/assets/home/term-loan.webp";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Zap,
  Shield,
  Scale,
  FileText,
  PhoneCall,
  Calendar,
};

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

interface ReasonItem {
  id: string;
  titleKey: string;
  bodyKey: string;
  iconName: string;
}

interface SpecItem {
  label: string;
  value: string;
}

export async function generateMetadata({ params }: HomePageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const t = await getTranslator(locale, "home.meta");
  const title = t("title");
  const description = t("description");

  return {
    title,
    description,
    alternates: localizedAlternates(locale),
    openGraph: { title, description, url: `/${locale}` },
    twitter: { title, description },
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asArray<T>(value: unknown): T[] | undefined {
  return Array.isArray(value) ? (value as T[]) : undefined;
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) {
    notFound();
  }

  const t = await getTranslator(locale, "home");
  const tGlobal = await getTranslator(locale, "global");
  const messages = getMessages(locale);
  const homeMessages = asRecord(messages.home) ?? {};

  const loanProductsMessages = asRecord(homeMessages.loanProducts) ?? {};
  const featuredProduct = asRecord(loanProductsMessages.featured) ?? {};
  const productSpecs = asArray<SpecItem>(featuredProduct.specs) ?? [];

  const whyNavDhanMessages = asRecord(homeMessages.whyNavDhan) ?? {};
  const reasons = asArray<ReasonItem>(whyNavDhanMessages.reasons) ?? [];

  const applyHref = `/${locale}/apply`;

  return (
    <>
      {/* Hero */}
      <Section background="cream" padding="default" id="top">
        <Container>
          <FadeIn>
            <div className="grid items-center gap-12 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-nt-orange-600">
                  {t("hero.eyebrow")}
                </p>
                <h1 className="font-display max-w-4xl text-4xl italic tracking-tight text-nt-slate-900 md:text-5xl lg:text-6xl">
                  {t("hero.headline")}
                </h1>
                <p className="mt-6 max-w-2xl text-lg leading-relaxed text-nt-slate-600 md:text-xl">
                  {t("hero.body")}
                </p>
                <div className="mt-8 flex flex-wrap gap-4">
                  <Link
                    href={applyHref}
                    className="inline-flex items-center gap-2 rounded-md bg-nt-orange-600 px-6 py-3 text-sm font-semibold text-white hover:bg-nt-orange-700"
                  >
                    {t("hero.primaryCta")}
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                  <a
                    href="#products"
                    className="inline-flex items-center gap-2 rounded-md border border-nt-slate-300 bg-white px-6 py-3 text-sm font-semibold text-nt-slate-900 hover:bg-nt-slate-50"
                  >
                    {t("hero.secondaryCta")}
                  </a>
                </div>
              </div>

              <div className="relative lg:col-span-5">
                <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl shadow-[0px_4px_20px_rgba(15,23,42,0.05)]">
                  <Image
                    src={HERO_IMAGE_URL}
                    alt={tGlobal("alt.customerPhoto", { name: "Business owner" })}
                    fill
                    priority
                    fetchPriority="high"
                    sizes="(max-width: 1024px) 100vw, 40vw"
                    className="object-cover"
                  />
                </div>
              </div>
            </div>
          </FadeIn>
        </Container>
      </Section>

      {/* Featured product */}
      <Section background="white" id="products">
        <Container>
          <FadeIn>
            <h2 className="font-display text-3xl tracking-tight text-nt-slate-900 md:text-4xl">
              {t("loanProducts.heading")}
            </h2>
            <p className="mt-4 max-w-2xl text-nt-slate-600">{t("loanProducts.body")}</p>

            <div className="mt-12 grid items-center gap-8 rounded-xl border border-nt-slate-200 bg-white p-5 shadow-[0px_4px_20px_rgba(15,23,42,0.05)] sm:p-8 md:grid-cols-12">
              <div className="md:col-span-7">
                <span className="inline-block rounded-full bg-[#FFF7ED] px-3 py-1 text-xs font-semibold text-nt-orange-700">
                  {String(featuredProduct.tag ?? "")}
                </span>
                <h3 className="mt-4 text-2xl font-semibold text-nt-slate-900">
                  {String(featuredProduct.title ?? "")}
                </h3>
                <p className="mt-3 max-w-xl leading-relaxed text-nt-slate-600">
                  {String(featuredProduct.description ?? "")}
                </p>
                <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {productSpecs.map((spec) => (
                    <div
                      key={spec.label}
                      className="rounded-lg border border-nt-slate-100 bg-nt-cream p-4"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-nt-slate-500">
                        {spec.label}
                      </p>
                      <p className="mt-1 text-lg font-semibold text-nt-slate-900">{spec.value}</p>
                    </div>
                  ))}
                </div>
                <Link
                  href={applyHref}
                  className="mt-8 inline-flex items-center gap-2 rounded-md bg-nt-orange-600 px-6 py-3 text-sm font-semibold text-white hover:bg-nt-orange-700"
                >
                  {String(featuredProduct.cta ?? t("loanProducts.productCta"))}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="md:col-span-5">
                <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-nt-slate-100 bg-nt-cream">
                  <Image
                    src={TERM_LOAN_IMAGE_URL}
                    alt={String(featuredProduct.imageAlt ?? "Term loan visualisation")}
                    fill
                    sizes="(max-width: 768px) 100vw, 40vw"
                    className="object-cover"
                  />
                </div>
              </div>
            </div>
          </FadeIn>
        </Container>
      </Section>

      {/* Why NavDhan */}
      <Section background="cream" id="why">
        <Container>
          <FadeIn>
            <p className="text-sm font-semibold uppercase tracking-wide text-nt-orange-600">
              {t("whyNavDhan.eyebrow")}
            </p>
            <h2 className="font-display mt-4 max-w-2xl text-3xl tracking-tight text-nt-slate-900 md:text-4xl">
              {t("whyNavDhan.heading")}
            </h2>
            <p className="mt-4 max-w-2xl text-nt-slate-600">{t("whyNavDhan.body")}</p>
          </FadeIn>
          <StaggerContainer
            className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            stagger={0.1}
          >
            {reasons.map((reason) => {
              const Icon = iconMap[reason.iconName] ?? Zap;
              return (
                <div
                  key={reason.id}
                  className="rounded-xl border border-nt-slate-200 bg-white p-6 shadow-[0px_4px_20px_rgba(15,23,42,0.05)]"
                >
                  <div className="inline-flex rounded-full bg-[#FFF7ED] p-3 text-nt-orange-600">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-nt-slate-900">
                    {reason.titleKey}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-nt-slate-600">{reason.bodyKey}</p>
                </div>
              );
            })}
          </StaggerContainer>
        </Container>
      </Section>

      {/* EMI calculator */}
      <Section background="white" id="emi">
        <Container size="default">
          <FadeIn>
            <EmiCalculator
              locale={locale}
              eyebrow={t("emiCalculator.eyebrow")}
              heading={t("emiCalculator.heading")}
              intro={t("emiCalculator.intro")}
              amountLabel={t("emiCalculator.amount")}
              rateLabel={t("emiCalculator.rate")}
              tenureLabel={t("emiCalculator.tenure")}
              monthlyLabel={t("emiCalculator.monthly")}
              principalLabel={t("emiCalculator.principal")}
              totalInterestLabel={t("emiCalculator.totalInterest")}
              totalPayableLabel={t("emiCalculator.totalPayable")}
              cta={t("emiCalculator.cta")}
              defaults={emiDefaults}
            />
          </FadeIn>
        </Container>
      </Section>

      {/* Final CTA */}
      <Section background="cream">
        <Container className="text-center">
          <FadeIn>
            <h2 className="font-display text-3xl tracking-tight text-nt-slate-900 md:text-4xl">
              {t("finalCta.heading")}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-nt-slate-600">{t("finalCta.subtext")}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href={applyHref}
                className="inline-flex items-center gap-2 rounded-md bg-nt-orange-600 px-6 py-3 text-sm font-semibold text-white hover:bg-nt-orange-700"
              >
                {t("finalCta.primaryCta")}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </FadeIn>
        </Container>
      </Section>
    </>
  );
}
