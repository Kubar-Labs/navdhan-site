"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import type { StoryCard, Cta } from "@/src/types";
import { Container } from "@/src/components/layout/Container";
import { Section } from "@/src/components/layout/Section";
import { FadeIn } from "@/src/components/motion/FadeIn";
import { StaggerContainer } from "@/src/components/motion/StaggerContainer";
import { useReducedMotion } from "@/src/hooks/useReducedMotion";
import { getMessages, type Messages } from "@/src/lib/i18n/messages";
import { cn } from "@/src/lib/utils/cn";

export interface CustomerStoriesProps {
  eyebrow: string;
  heading: string;
  cta: Cta;
  stories: StoryCard[];
  locale?: string;
  variant?: "cream";
  layout?: "grid" | "carousel";
}

interface LocalizedStory {
  id: string;
  name: string;
  role: string;
  question: string;
  outcome: string;
  imageAsset?: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function useStories(stories: StoryCard[], messages?: Messages): LocalizedStory[] {
  return useMemo(() => {
    return stories.map((story) => {
      const role = messages
        ? getString(messages, `home.customerStories.items.${story.id}.role`) || story.roleKey
        : story.roleKey;
      const question = messages
        ? getString(messages, `home.customerStories.items.${story.id}.question`) ||
          story.questionKey
        : story.questionKey;
      const outcome = messages
        ? getString(messages, `home.customerStories.items.${story.id}.outcome`) || story.outcomeKey
        : story.outcomeKey;
      return {
        id: story.id,
        name: story.name,
        role,
        question,
        outcome,
        imageAsset: story.imageAsset || undefined,
      };
    });
  }, [stories, messages]);
}

function getString(messages: Messages, path: string): string | undefined {
  const parts = path.split(".");
  let current: unknown = messages;
  for (const part of parts) {
    if (current === null || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

function StoryAvatar({ story }: { story: LocalizedStory }) {
  if (story.imageAsset) {
    return (
      <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-full">
        <Image src={story.imageAsset} alt={story.name} fill className="object-cover" sizes="56px" />
      </div>
    );
  }
  return (
    <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-[#FDF8F3] text-nt-slate-700">
      <span className="text-sm font-semibold">{getInitials(story.name)}</span>
    </div>
  );
}

function StoryCardView({ story }: { story: LocalizedStory }) {
  return (
    <article className="flex h-full flex-col rounded-xl border border-nt-slate-200 bg-white p-6 transition-shadow duration-300 hover:shadow-md">
      <div className="flex items-center gap-3">
        <StoryAvatar story={story} />
        <div>
          <h3 className="text-base font-semibold text-nt-slate-900">{story.name}</h3>
          <p className="text-sm text-nt-orange-600">{story.role}</p>
        </div>
      </div>
      <blockquote className="mt-4 flex-1 text-sm italic leading-relaxed text-nt-slate-600">
        &ldquo;{story.question}&rdquo;
      </blockquote>
      <div className="mt-4 rounded-lg bg-nt-cream p-3">
        <p className="text-sm font-medium text-nt-slate-800">{story.outcome}</p>
      </div>
    </article>
  );
}

export function CustomerStories({
  eyebrow,
  heading,
  cta,
  stories,
  locale = "en",
  layout = "grid",
}: CustomerStoriesProps) {
  const reduced = useReducedMotion();
  const messages = getMessages(locale);
  const localized = useStories(stories, messages);

  const wrapperClass = cn(
    "grid gap-6",
    layout === "grid" ? "sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1",
  );

  return (
    <Section background="cream" id="stories">
      <Container>
        <FadeIn>
          <p className="text-sm font-semibold uppercase tracking-wide text-nt-orange-600">
            {eyebrow}
          </p>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-nt-slate-900 md:text-4xl">
              {heading}
            </h2>
            <Link
              href={cta.href}
              className="inline-flex items-center text-sm font-semibold text-nt-orange-600 hover:text-nt-orange-700"
            >
              {cta.labelKey}
              <span aria-hidden="true" className="ml-1">
                &rarr;
              </span>
            </Link>
          </div>
        </FadeIn>

        {reduced || layout === "grid" ? (
          <StaggerContainer className={cn("mt-10", wrapperClass)} stagger={0.08}>
            {localized.map((story) => (
              <StoryCardView key={story.id} story={story} />
            ))}
          </StaggerContainer>
        ) : (
          <FadeIn className="mt-10">
            <div className={wrapperClass}>
              {localized.map((story) => (
                <StoryCardView key={story.id} story={story} />
              ))}
            </div>
          </FadeIn>
        )}
      </Container>
    </Section>
  );
}
