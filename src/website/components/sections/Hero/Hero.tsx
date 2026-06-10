import { ShoppingBag, Cpu, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/website/components/shared";
import { useT } from "@/website/i18n";
import { APPLY_URL } from "@/website/config";

const STEP_ICONS = [ShoppingBag, Cpu, Building2];

function CreditFlowCard() {
  const { card } = useT().hero;
  return (
    <div className="rounded-xl border border-mist bg-paper p-6 sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-subheading font-semibold text-ink">{card.title}</h3>
          <p className="mt-1 text-body-sm text-graphite">{card.subtitle}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-md bg-fog px-2.5 py-1 text-caption font-medium text-pewter">
          <span className="size-1.5 rounded-full bg-ember" aria-hidden />
          {card.live}
        </span>
      </div>

      <ol className="mt-6 space-y-5">
        {card.steps.map((step, i) => {
          const Icon = STEP_ICONS[i];
          return (
            <li key={step.title} className="flex items-start gap-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-fog text-ink">
                <Icon className="size-[18px]" aria-hidden />
              </div>
              <div>
                <h4 className="text-body-sm font-semibold text-ink">
                  <span className="text-steel tabular-nums">{i + 1}.</span> {step.title}
                </h4>
                <p className="mt-1 text-body-sm leading-relaxed text-graphite">{step.body}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-6 flex flex-col gap-1.5 border-t border-mist pt-4 text-body-sm text-graphite sm:flex-row sm:items-center sm:justify-between">
        <span>
          {card.feeLabel} <span className="font-semibold text-ink">{card.feeValue}</span>
        </span>
        <span>
          {card.platformLabel} <span className="font-semibold text-ink">{card.platformValue}</span>
        </span>
      </div>
    </div>
  );
}

export function Hero() {
  const { hero } = useT();
  return (
    <section className="bg-paper">
      <div className="container-prose grid items-start gap-x-12 gap-y-10 pb-16 pt-10 md:grid-cols-[1fr_1fr] md:pb-24 md:pt-14 lg:grid-cols-[1.05fr_1fr]">
        <Reveal className="max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-md border border-mist px-2.5 py-1 text-caption font-medium uppercase tracking-[0.08em] text-pewter">
            <span className="size-1.5 rounded-full bg-ember" aria-hidden />
            {hero.badge}
          </span>

          <h1 className="mt-6 text-[2.75rem] font-semibold leading-[1.04] tracking-[-0.03em] text-ink sm:text-[3.5rem] lg:text-display">
            {hero.titleLead} <span className="text-ember">{hero.titleAccent}</span>
          </h1>

          <p className="mt-6 text-subheading text-graphite">{hero.body}</p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="ember" size="lg">
              <a href={APPLY_URL}>{hero.apply}</a>
            </Button>
            <Button variant="outline" size="lg">
              {hero.demo}
            </Button>
          </div>

          <dl className="mt-12 grid grid-cols-3 gap-6 border-t border-mist pt-8">
            {hero.stats.map((stat) => (
              <div key={stat.label}>
                <dt className="text-caption uppercase tracking-[0.06em] text-steel">{stat.label}</dt>
                <dd className="mt-1 text-heading-sm font-semibold tracking-[-0.02em] text-ink">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>

        <Reveal>
          <CreditFlowCard />
        </Reveal>
      </div>
    </section>
  );
}
