import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import { SectionHeading, Reveal } from "@/website/components/shared";
import { useT } from "@/website/i18n";
import { APPLY_URL } from "@/website/config";
import { REASON_ICONS } from "./content";

export function WhyNavdhan() {
  const { why } = useT();
  return (
    <section id="why" className="bg-fog py-20 md:py-28">
      <div className="container-prose">
        <div className="grid gap-12 lg:grid-cols-[1fr_2fr] lg:items-start lg:gap-16">
          <Reveal>
            <SectionHeading eyebrow={why.eyebrow}>{why.heading}</SectionHeading>
            <Button asChild variant="ember" className="mt-6">
              <a href={APPLY_URL}>{why.apply}</a>
            </Button>
          </Reveal>

          <Reveal stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {why.reasons.map((reason, i) => {
              const Icon = REASON_ICONS[i];
              return (
                <li
                  key={reason.title}
                  className="group list-none rounded-xl border border-mist bg-paper p-6 transition-colors hover:border-ink"
                >
                  <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-fog text-ink transition-colors group-hover:bg-ink group-hover:text-paper">
                    {Icon ? <Icon className="size-5" aria-hidden /> : null}
                  </div>
                  <h3 className="text-subheading font-semibold text-ink">{reason.title}</h3>
                  <p className="mt-2 text-body-sm text-graphite">{reason.description}</p>
                </li>
              );
            })}
          </Reveal>
        </div>

        <div className="mt-16 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-mist pt-10 text-caption font-medium uppercase tracking-[0.1em] text-steel">
          {why.badges.map((badge, i) => (
            <Fragment key={badge}>
              {i > 0 && <span className="text-ember">◆</span>}
              <span>{badge}</span>
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
