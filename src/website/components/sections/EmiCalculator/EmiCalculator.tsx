import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Eyebrow, SectionHeading, Reveal } from "@/website/components/shared";
import { useT } from "@/website/i18n";
import { inr } from "@/website/lib/format";
import { calcEmi } from "@/website/lib/finance";
import { EMI_DEFAULTS, EMI_RANGES } from "./content";

export function EmiCalculator() {
  const { emi: t } = useT();
  const [amount, setAmount] = useState(EMI_DEFAULTS.amount);
  const [rate, setRate] = useState(EMI_DEFAULTS.rate);
  const [tenure, setTenure] = useState(EMI_DEFAULTS.tenure);

  const emi = useMemo(() => calcEmi(amount, rate, tenure), [amount, rate, tenure]);
  const totalPayable = emi * tenure;
  const totalInterest = totalPayable - amount;

  return (
    <section id="emi" className="bg-paper py-20 md:py-28">
      <Reveal className="container-prose grid gap-10 rounded-xl border border-mist bg-paper p-8 md:grid-cols-2 md:p-12">
        <div>
          <SectionHeading eyebrow={t.eyebrow} headingClassName="mt-3">
            {t.heading}
          </SectionHeading>
          <p className="mt-4 max-w-md text-body text-graphite">{t.intro}</p>

          <div className="mt-8 space-y-7">
            <Field
              label={t.amount}
              value={inr(amount)}
              control={
                <Slider
                  value={[amount]}
                  min={EMI_RANGES.amount.min}
                  max={EMI_RANGES.amount.max}
                  step={EMI_RANGES.amount.step}
                  onValueChange={([v]) => setAmount(v)}
                />
              }
            />
            <Field
              label={t.rate}
              value={`${rate.toFixed(1)}${t.rateSuffix}`}
              control={
                <Slider
                  value={[rate]}
                  min={EMI_RANGES.rate.min}
                  max={EMI_RANGES.rate.max}
                  step={EMI_RANGES.rate.step}
                  onValueChange={([v]) => setRate(v)}
                />
              }
            />
            <Field
              label={t.tenure}
              value={`${tenure} ${t.months}`}
              control={
                <Slider
                  value={[tenure]}
                  min={EMI_RANGES.tenure.min}
                  max={EMI_RANGES.tenure.max}
                  step={EMI_RANGES.tenure.step}
                  onValueChange={([v]) => setTenure(v)}
                />
              }
            />
          </div>
        </div>

        <div className="flex flex-col justify-between gap-8 rounded-xl bg-fog p-8">
          <div>
            <Eyebrow>{t.monthly}</Eyebrow>
            <p className="mt-3 text-[3.25rem] font-semibold leading-none tracking-[-0.03em] tabular-nums text-ember">
              {inr(emi)}
            </p>

            <dl className="mt-8 grid grid-cols-2 gap-6 border-t border-mist pt-6">
              <Stat label={t.principal} value={inr(amount)} />
              <Stat label={t.totalInterest} value={inr(totalInterest)} />
              <Stat label={t.totalPayable} value={inr(totalPayable)} />
              <Stat label={t.tenure} value={`${tenure} ${t.mo}`} />
            </dl>
          </div>

          <Button variant="ember" size="lg" className="w-full">
            {t.cta}
          </Button>
        </div>
      </Reveal>
    </section>
  );
}

function Field({
  label,
  value,
  control,
}: {
  label: string;
  value: string;
  control: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <Label className="text-body-sm text-graphite">{label}</Label>
        <span className="text-subheading font-semibold tabular-nums text-ink">{value}</span>
      </div>
      <div className="mt-3">{control}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-caption uppercase tracking-[0.06em] text-steel">{label}</dt>
      <dd className="mt-1 text-subheading font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}
