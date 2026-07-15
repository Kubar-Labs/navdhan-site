import Image from "next/image";
import Link from "next/link";
import {
  Award,
  Calendar,
  ChevronRight,
  FileText,
  PhoneCall,
  Scale,
  Shield,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Container } from "@/src/components/layout/Container";
import { Section } from "@/src/components/layout/Section";
import { FadeIn } from "@/src/components/motion/FadeIn";
import { StaggerContainer } from "@/src/components/motion/StaggerContainer";
import { EmiCalculator } from "@/src/components/sections/EmiCalculator";
import { CustomerStories } from "@/src/components/sections/CustomerStories.stub";
import { getTranslator } from "@/src/lib/i18n/translations";
import { getMessages } from "@/src/lib/i18n/messages";
import { associationBadges, customerStories, emiDefaults } from "@/src/lib/data/siteData";
import { isValidLocale } from "@/src/lib/i18n/config";
import { notFound } from "next/navigation";

const HERO_IMAGE_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCXYUdUcaSgFmtSJhKeYlcShRRxa5ZvFKdahXIEa9OFW8UWsJfJsEQD8e9KTSZ8RGoaVnet90ggdrFOa9K1kaIhcztAl08LGDalme_uFBKR25id3fDe7LMaMAnDZhrZ98LicKmp7TI27aySuK70OzSrKi-tNrzCNSQZWgOiD56MRL9KM8YV1oIn0-8vusnAgYQR-gniOLHFYz29EURVYuLET9Bwlf7eumVUzgbWjwdBm3KBu4d2PXJ2x4ZArt8DZj8JIstwlhaTM8Q";

const TERM_LOAN_IMAGE_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCWwsgXKRo1SgKeGIArC9I3DjcqLrozkGerKRgGeowwLRjhVagbiG5gpC10ZShEF3qpX0bi9DsVNUj72OVlU1aVzNg2ME_AzQM5rhtxVqB_apfSpgle1HbqLq_i8Xr7KnBqYzXGqzNt7V5Tsbj_BGBS_DsIU3xz5TQd381uJEaNTrYRtUngmw1rFALtzg3abU5EwSgy6ep7l7vYF7EJ4QJI36swriPWTDV6fzjdGP36wxW2uiYbll4Uf00DsQjoJmDU8tmW7OT3140";

const associationBadgeOrder = ["FinVision", "FACE", "Startup Mahakumbh", "STPI FinGlobe"];

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

interface StatItem {
  value: string;
  label: string;
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

  const heroMessages = asRecord(homeMessages.hero) ?? {};
  const stats = asArray<StatItem>(heroMessages.stats) ?? [];
  const approvalCard = asRecord(heroMessages.approvalCard) ?? {};

  const loanProductsMessages = asRecord(homeMessages.loanProducts) ?? {};
  const featuredProduct = asRecord(loanProductsMessages.featured) ?? {};
  const productSpecs = asArray<SpecItem>(featuredProduct.specs) ?? [];

  const whyNavDhanMessages = asRecord(homeMessages.whyNavDhan) ?? {};
  const reasons = asArray<ReasonItem>(whyNavDhanMessages.reasons) ?? [];

  const applyHref = "/apply";

  const orderedBadges = associationBadgeOrder
    .map((name) => associationBadges.find((badge) => badge.name === name))
    .filter((badge): badge is (typeof associationBadges)[number] => badge !== undefined);

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
                <div className="mt-12 grid gap-8 sm:grid-cols-3">
                  {stats.map((stat) => (
                    <div key={stat.label}>
                      <p className="text-2xl font-bold text-nt-slate-900">{stat.value}</p>
                      <p className="text-sm text-nt-slate-600">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative lg:col-span-5">
                <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl shadow-[0px_4px_20px_rgba(15,23,42,0.05)]">
                  <Image
                    src={HERO_IMAGE_URL}
                    alt={tGlobal("alt.customerPhoto", { name: "Business owner" })}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 40vw"
                    className="object-cover"
                  />
                </div>
                <div className="absolute top-8 left-4 flex items-center gap-3 rounded-lg border border-nt-slate-100 bg-white p-4 shadow-lg">
                  <div className="rounded-full bg-nt-green-500/10 p-2">
                    <TrendingUp className="h-5 w-5 text-nt-green-500" />
                  </div>
                  <div>
                    <p className="text-xs text-nt-slate-500">{t("hero.approvalCard.label")}</p>
                    <p className="text-lg font-bold text-nt-slate-900">
                      {String(approvalCard.value ?? "")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>
        </Container>
      </Section>

      {/* Association badges */}
      <Section background="white" padding="tight">
        <Container>
          <FadeIn>
            <p className="text-center text-sm font-semibold uppercase tracking-wide text-nt-slate-500">
              {t("associationBadges.eyebrow")}
            </p>
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {orderedBadges.map((badge) => {
                const title = t(`associationBadges.${badge.name}.title`);
                const description = t(`associationBadges.${badge.name}.description`);
                return (
                  <div
                    key={badge.name}
                    className="rounded-xl border border-nt-slate-200 bg-white p-4 shadow-[0px_4px_20px_rgba(15,23,42,0.05)] sm:p-5"
                  >
                    <div className="flex h-10 items-center">
                      {badge.logoAsset ? (
                        <div
                          className={
                            badge.name === "FinVision"
                              ? "flex h-10 w-28 items-center justify-center overflow-hidden rounded-lg bg-slate-950 px-3 py-1.5 shadow-sm border border-slate-800"
                              : "flex h-10 w-28 items-center justify-start overflow-hidden rounded-lg"
                          }
                        >
                          <Image
                            src={badge.logoAsset}
                            alt={tGlobal(`alt.${badge.altKey.split(".").pop()}`, {
                              name: badge.name,
                            })}
                            width={112}
                            height={40}
                            className="h-full w-auto object-contain rounded-lg"
                          />
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 rounded-lg border border-nt-orange-200 bg-nt-orange-50 px-2 py-0.5">
                          <Award className="h-4 w-4 text-nt-orange-600" />
                        </div>
                      )}
                    </div>
                    <p className="mt-3 text-sm font-bold text-nt-slate-900">{title}</p>
                    <p className="text-xs leading-relaxed text-nt-slate-600">{description}</p>
                  </div>
                );
              })}
            </div>
          </FadeIn>
        </Container>
      </Section>

      {/* Featured product */}
      <Section background="white" id="products">
        <Container>
          <FadeIn>
            <h2 className="font-display text-3xl italic tracking-tight text-nt-slate-900 md:text-4xl">
              {t("loanProducts.heading")}
            </h2>
            <p className="mt-4 max-w-2xl text-nt-slate-600">{t("loanProducts.body")}</p>

            <div className="mt-12 grid items-center gap-8 rounded-xl border border-nt-slate-200 bg-white p-8 shadow-[0px_4px_20px_rgba(15,23,42,0.05)] md:grid-cols-12">
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
                <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-2">
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
            <h2 className="font-display mt-4 max-w-2xl text-3xl italic tracking-tight text-nt-slate-900 md:text-4xl">
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

      {/* Customer stories */}
      <CustomerStories
        locale={locale}
        eyebrow={t("customerStories.eyebrow")}
        heading={t("customerStories.heading")}
        cta={{ labelKey: t("customerStories.cta"), href: applyHref }}
        stories={customerStories}
      />

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
            <h2 className="font-display text-3xl italic tracking-tight text-nt-slate-900 md:text-4xl">
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
