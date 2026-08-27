import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/src/lib/utils/cn";

export function MarketingContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[1440px] px-5 sm:px-8 xl:px-20", className)}>
      {children}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary";

interface ButtonLinkProps {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: "medium" | "large";
  arrow?: boolean;
  className?: string;
}

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-xl border text-sm font-semibold tracking-[0.01em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nt-orange-700";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "border-nt-orange-600 bg-nt-orange-700 text-white hover:border-nt-orange-700 hover:bg-nt-orange-800",
  secondary:
    "border-nt-slate-300 bg-white text-nt-slate-900 hover:border-nt-slate-400 hover:bg-nt-slate-50",
};

export function ButtonLink({
  href,
  children,
  variant = "primary",
  size = "medium",
  arrow = true,
  className,
}: ButtonLinkProps) {
  const classes = cn(
    buttonBase,
    buttonVariants[variant],
    size === "large" ? "min-h-14 px-6 py-4" : "min-h-12 px-4 py-3",
    className,
  );
  const content = (
    <>
      <span>{children}</span>
      {arrow ? <span aria-hidden="true">→</span> : null}
    </>
  );

  if (href.startsWith("mailto:") || href.startsWith("tel:")) {
    return (
      <a href={href} className={classes}>
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={classes}>
      {content}
    </Link>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "inline-flex items-center gap-2 rounded-full bg-nt-orange-50 px-3 py-2 text-xs font-semibold uppercase leading-4 tracking-[0.08em] text-nt-orange-700",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-nt-orange-600" aria-hidden="true" />
      {children}
    </p>
  );
}

export function SectionHeading({
  title,
  description,
  align = "left",
  className,
}: {
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex max-w-[860px] flex-col gap-4",
        align === "center" && "mx-auto items-center text-center",
        className,
      )}
    >
      <h2 className="text-[2rem] font-semibold leading-10 tracking-[-0.5px] text-nt-slate-900 lg:text-[2.5rem] lg:leading-[3rem]">
        {title}
      </h2>
      {description ? (
        <p className="max-w-[820px] text-base leading-6 text-nt-slate-600 lg:text-lg lg:leading-7">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function MarketingSection({
  children,
  id,
  tone = "canvas",
  compact = false,
  className,
  containerClassName,
}: {
  children: ReactNode;
  id?: string;
  tone?: "canvas" | "subtle" | "muted";
  compact?: boolean;
  className?: string;
  containerClassName?: string;
}) {
  const tones = {
    canvas: "bg-white",
    subtle: "bg-nt-cream",
    muted: "bg-nt-slate-50",
  };

  return (
    <section
      id={id}
      className={cn(tones[tone], compact ? "py-12 lg:py-16" : "py-[72px] lg:py-28", className)}
    >
      <MarketingContainer className={containerClassName}>{children}</MarketingContainer>
    </section>
  );
}

export interface FeatureCardContent {
  eyebrow: string;
  title: string;
  description: string;
  href?: string;
  linkLabel?: string;
}

export function FeatureCard({ eyebrow, title, description, href, linkLabel }: FeatureCardContent) {
  const linkClasses =
    "mt-auto inline-flex pt-1 text-sm font-semibold text-nt-orange-700 hover:text-nt-orange-800 focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nt-orange-700";
  const linkContent = linkLabel ? (
    <>
      {linkLabel}{" "}
      <span aria-hidden="true" className="ml-1">
        →
      </span>
    </>
  ) : null;

  return (
    <article className="flex h-full flex-col items-start gap-4 rounded-2xl border border-nt-slate-200 bg-white p-6 shadow-[var(--shadow-card)]">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-xl bg-nt-orange-50 text-2xl font-semibold text-nt-orange-600"
        aria-hidden="true"
      >
        ↗
      </div>
      <p className="text-xs font-semibold uppercase leading-4 tracking-[0.08em] text-nt-orange-700">
        {eyebrow}
      </p>
      <h3 className="text-2xl font-semibold leading-8 tracking-[-0.5px] text-nt-slate-900">
        {title}
      </h3>
      <p className="text-base leading-6 text-nt-slate-600">{description}</p>
      {href && linkLabel ? (
        href.startsWith("mailto:") || href.startsWith("tel:") ? (
          <a href={href} className={linkClasses}>
            {linkContent}
          </a>
        ) : (
          <Link href={href} className={linkClasses}>
            {linkContent}
          </Link>
        )
      ) : null}
    </article>
  );
}

export function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex h-full flex-col gap-4 rounded-2xl border border-nt-slate-200 bg-nt-cream p-6">
      <p className="text-[2rem] font-bold leading-10 tracking-[-0.5px] text-nt-slate-900">
        {value}
      </p>
      <p className="text-sm leading-5 text-nt-slate-600">{label}</p>
    </div>
  );
}

export interface ProcessStepContent {
  step: string;
  title: string;
  description: string;
}

export function ProcessCard({ step, title, description }: ProcessStepContent) {
  return (
    <article className="flex h-full flex-col items-start gap-4 rounded-2xl border border-nt-slate-200 bg-white p-6">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-nt-slate-900 text-xs font-semibold tracking-[0.08em] text-white">
        {step}
      </span>
      <h3 className="text-2xl font-semibold leading-8 tracking-[-0.5px] text-nt-slate-900">
        {title}
      </h3>
      <p className="text-base leading-6 text-nt-slate-600">{description}</p>
    </article>
  );
}

export function CheckList({ items, className }: { items: string[]; className?: string }) {
  return (
    <ul className={cn("space-y-3", className)}>
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-base leading-6 text-nt-green-700">
          <span aria-hidden="true">✓</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function CtaBanner({
  title,
  description,
  href,
  ctaLabel = "Get started",
  tone = "inverse",
}: {
  title: string;
  description: string;
  href: string;
  ctaLabel?: string;
  tone?: "accent" | "inverse";
}) {
  const accent = tone === "accent";
  return (
    <div
      className={cn(
        "flex flex-col gap-8 rounded-3xl p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between lg:gap-12 lg:p-12",
        accent ? "bg-nt-orange-700 text-white" : "bg-nt-slate-900 text-white",
      )}
    >
      <div className="max-w-[780px] space-y-4">
        <h2 className="text-[2rem] font-semibold leading-10 tracking-[-0.5px] lg:text-[2.5rem] lg:leading-[3rem]">
          {title}
        </h2>
        <p
          className={cn(
            "max-w-[720px] text-base leading-6 lg:text-lg lg:leading-7",
            accent ? "text-white" : "text-nt-slate-300",
          )}
        >
          {description}
        </p>
      </div>
      <ButtonLink
        href={href}
        variant={accent ? "secondary" : "primary"}
        size="large"
        className="w-full shrink-0 lg:w-auto"
      >
        {ctaLabel}
      </ButtonLink>
    </div>
  );
}

export interface FlowCardContent {
  eyebrow: string;
  title: string;
  description: string;
  accent?: boolean;
}

function FlowCard({ eyebrow, title, description, accent = false }: FlowCardContent) {
  return (
    <article
      className={cn(
        "flex h-full flex-col gap-3 rounded-2xl border p-6",
        accent ? "border-nt-orange-600 bg-nt-orange-50" : "border-nt-slate-200 bg-nt-slate-50",
      )}
    >
      <p className="text-xs font-semibold uppercase leading-4 tracking-[0.08em] text-nt-orange-700">
        {eyebrow}
      </p>
      <h3 className="text-2xl font-semibold leading-8 tracking-[-0.5px] text-nt-slate-900">
        {title}
      </h3>
      <p className="text-sm leading-5 text-nt-slate-600">{description}</p>
    </article>
  );
}

export function SystemFlow({
  cards,
}: {
  cards: [FlowCardContent, FlowCardContent, FlowCardContent];
}) {
  return (
    <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1.1fr_auto_1fr] lg:gap-5">
      <FlowCard {...cards[0]} />
      <span
        className="flex items-center justify-center text-3xl font-semibold text-nt-orange-600"
        aria-hidden="true"
      >
        <span className="lg:hidden">↓</span>
        <span className="hidden lg:inline">→</span>
      </span>
      <FlowCard {...cards[1]} accent />
      <span
        className="flex items-center justify-center text-3xl font-semibold text-nt-orange-600"
        aria-hidden="true"
      >
        <span className="lg:hidden">↓</span>
        <span className="hidden lg:inline">→</span>
      </span>
      <FlowCard {...cards[2]} />
    </div>
  );
}

export function FaqItem({
  question,
  answer,
  defaultOpen = false,
}: {
  question: string;
  answer: string;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-xl border border-nt-slate-200 bg-white p-4 sm:p-6"
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-sm font-semibold leading-5 text-nt-slate-900 marker:content-none sm:text-2xl sm:leading-8 [&::-webkit-details-marker]:hidden">
        <span>{question}</span>
        <span
          aria-hidden="true"
          className="text-2xl leading-8 text-nt-orange-700 transition-transform group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <p className="mt-3 max-w-[680px] text-sm leading-5 text-nt-slate-600 sm:mt-4 sm:text-base sm:leading-6">
        {answer}
      </p>
    </details>
  );
}
