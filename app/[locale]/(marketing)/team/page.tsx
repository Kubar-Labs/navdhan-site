import Image from "next/image";
import Link from "next/link";
import { Heart, Eye, Zap } from "lucide-react";
import { Container } from "@/src/components/layout/Container";
import { Section } from "@/src/components/layout/Section";
import { FadeIn } from "@/src/components/motion/FadeIn";
import { StaggerContainer } from "@/src/components/motion/StaggerContainer";
import teamData from "@/src/lib/data/team.json";
import { getTranslator } from "@/src/lib/i18n/translations";
import { getMessages } from "@/src/lib/i18n/messages";
import { getTeamLocalization } from "@/src/lib/i18n/team-mapper.stub";
import { isValidLocale } from "@/src/lib/i18n/config";
import { localizedAlternates } from "@/src/lib/i18n/metadata";
import { notFound } from "next/navigation";

interface TeamPageProps {
  params: Promise<{ locale: string }>;
}

const valueIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Heart,
  Eye,
  Zap,
};

interface ValueItem {
  id: string;
  title: string;
  body: string;
  iconName: string;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asArray<T>(value: unknown): T[] | undefined {
  return Array.isArray(value) ? (value as T[]) : undefined;
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
  const t = await getTranslator(locale);
  const messages = getMessages(locale);
  const team = getTeamLocalization(messages, locale);
  const teamMessages = asRecord(messages.team) ?? {};
  const valuesMessages = asRecord(teamMessages.values) ?? {};
  const values = asArray<ValueItem>(valuesMessages.items) ?? [];

  return (
    <>
      <Section background="cream">
        <Container className="max-w-4xl">
          <FadeIn>
            <p className="text-sm font-semibold uppercase tracking-wide text-nt-orange-600">
              {t("team.members.eyebrow")}
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-nt-slate-900 md:text-5xl">
              {t("team.hero.heading")}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-nt-slate-600">
              {t("team.hero.subtext")}
            </p>
          </FadeIn>
        </Container>
      </Section>

      <Section background="white">
        <Container className="max-w-3xl text-center">
          <FadeIn>
            <p className="text-sm font-semibold uppercase tracking-wide text-nt-orange-600">
              {t("team.mission.eyebrow")}
            </p>
            <h2 className="font-display mt-4 text-3xl tracking-tight text-nt-slate-900 md:text-4xl">
              {t("team.mission.heading")}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-nt-slate-600">
              {t("team.mission.body")}
            </p>
          </FadeIn>
        </Container>
      </Section>

      <Section background="cream">
        <Container>
          <FadeIn>
            <p className="text-sm font-semibold uppercase tracking-wide text-nt-orange-600">
              {t("team.values.eyebrow")}
            </p>
            <h2 className="font-display mt-4 text-3xl tracking-tight text-nt-slate-900 md:text-4xl">
              {t("team.values.heading")}
            </h2>
          </FadeIn>
          <StaggerContainer
            className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            stagger={0.1}
          >
            {values.map((value) => {
              const Icon = valueIconMap[value.iconName] ?? Zap;
              return (
                <div
                  key={value.id}
                  className="rounded-xl border border-nt-slate-200 bg-white p-6 shadow-[0px_4px_20px_rgba(15,23,42,0.05)]"
                >
                  <div className="inline-flex rounded-full bg-[#FFF7ED] p-3 text-nt-orange-600">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-nt-slate-900">{value.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-nt-slate-600">{value.body}</p>
                </div>
              );
            })}
          </StaggerContainer>
        </Container>
      </Section>

      <Section background="white">
        <Container>
          <p className="text-sm font-semibold uppercase tracking-wide text-nt-orange-600">
            {t("team.members.eyebrow")}
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-nt-slate-900">
            {t("team.members.heading")}
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {teamData.members.map((member) => (
              <div
                key={member.id}
                className="rounded-xl border border-nt-slate-200 bg-nt-cream p-6"
              >
                <div className="relative h-24 w-24 overflow-hidden rounded-full bg-nt-slate-200">
                  {member.imageAsset ? (
                    <Image
                      src={member.imageAsset}
                      alt={member.name}
                      fill
                      className="object-cover"
                      sizes="96px"
                    />
                  ) : null}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-nt-slate-900">{member.name}</h3>
                <p className="text-sm font-medium text-nt-orange-600">
                  {team.getMemberCopy(member.id, "role")}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-nt-slate-600">
                  {team.getMemberCopy(member.id, "bio")}
                </p>
                {member.linkedIn ? (
                  <a
                    href={member.linkedIn}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex text-sm font-medium text-nt-slate-500 hover:text-nt-orange-600"
                  >
                    LinkedIn →
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <Section background="cream">
        <Container>
          <p className="text-sm font-semibold uppercase tracking-wide text-nt-orange-600">
            {t("team.advisors.eyebrow")}
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-nt-slate-900">
            {t("team.advisors.heading")}
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {teamData.advisors.map((advisor) => (
              <div
                key={advisor.id}
                className="flex gap-5 rounded-xl border border-nt-slate-200 bg-white p-6"
              >
                <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-full bg-nt-slate-100">
                  {advisor.imageAsset ? (
                    <Image
                      src={advisor.imageAsset}
                      alt={advisor.name}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  ) : null}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-nt-slate-900">{advisor.name}</h3>
                  <p className="text-sm font-medium text-nt-orange-600">
                    {team.getAdvisorCopy(advisor.id, "domain")}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-nt-slate-600">
                    {team.getAdvisorCopy(advisor.id, "contribution")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <Section background="white">
        <Container className="text-center">
          <FadeIn>
            <h2 className="text-2xl font-semibold tracking-tight text-nt-slate-900 md:text-3xl">
              {t("team.join.heading")}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-nt-slate-600">{t("team.join.subtext")}</p>
            <Link
              href={teamData.joinHref}
              className="mt-6 inline-flex rounded-md bg-nt-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-nt-orange-700"
            >
              {t("team.join.cta")}
            </Link>
          </FadeIn>
        </Container>
      </Section>
    </>
  );
}
