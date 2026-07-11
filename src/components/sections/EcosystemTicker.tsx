"use client";

import Image from "next/image";
import type { PartnerItem } from "@/src/types";
import { Container } from "@/src/components/layout/Container";
import { FadeIn } from "@/src/components/motion/FadeIn";
import { useReducedMotion } from "@/src/hooks/useReducedMotion";

export interface EcosystemTickerProps {
  eyebrow: string;
  partners: PartnerItem[];
}

export function EcosystemTicker({ eyebrow, partners }: EcosystemTickerProps) {
  const reduced = useReducedMotion();
  const duplicated = [...partners, ...partners];

  if (reduced) {
    return (
      <section className="bg-nt-slate-900 py-1.5 sm:py-2">
        <Container>
          <p className="text-center text-sm font-semibold uppercase tracking-wide text-nt-slate-300">
            {eyebrow}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-6 md:gap-10">
            {partners.map((partner) => (
              <TickerLogo key={`${partner.name}-static`} partner={partner} />
            ))}
          </div>
        </Container>
      </section>
    );
  }

  return (
    <section className="bg-nt-slate-900 py-1.5 sm:py-2">
      <Container>
        <FadeIn className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-nt-slate-300">
            {eyebrow}
          </p>
        </FadeIn>
      </Container>

      <div
        className="relative mt-1.5 overflow-hidden"
        style={{
          maskImage: "linear-gradient(to right, transparent, white 6%, white 94%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent, white 6%, white 94%, transparent)",
        }}
        aria-roledescription="marquee"
        aria-label="Technology partner logos"
      >
        <div className="animate-marquee flex w-max items-center gap-8 md:gap-10 hover:[animation-play-state:paused]">
          {duplicated.map((partner, index) => (
            <TickerLogo key={`${partner.name}-${index}`} partner={partner} />
          ))}
        </div>
      </div>
    </section>
  );
}

interface TickerLogoProps {
  partner: PartnerItem;
}

function TickerLogo({ partner }: TickerLogoProps) {
  const alt = partner.altKey ? `${partner.name} logo` : `${partner.name} logo`;
  return (
    <div
      aria-label={partner.name}
      className="group inline-flex flex-shrink-0 items-center justify-center rounded-lg p-0.5"
    >
      {partner.logoAsset ? (
        <Image
          src={partner.logoAsset}
          alt={alt}
          width={160}
          height={44}
          loading="eager"
          decoding="async"
          className="h-5 w-auto object-contain opacity-80 transition-opacity duration-300 hover:opacity-100 sm:h-6"
        />
      ) : (
        <span className="text-sm font-semibold text-white/80 transition group-hover:text-white">
          {partner.name}
        </span>
      )}
    </div>
  );
}
