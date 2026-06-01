import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

const inr = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.round(value));

function calcEmi(principal: number, annualRatePct: number, months: number) {
  const r = annualRatePct / 12 / 100;
  if (r === 0) return principal / months;
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

export function EmiCalculator() {
  const [amount, setAmount] = useState(2_500_000); // ₹25L
  const [rate, setRate] = useState(14);
  const [tenure, setTenure] = useState(36);

  const emi = useMemo(() => calcEmi(amount, rate, tenure), [amount, rate, tenure]);
  const totalPayable = emi * tenure;
  const totalInterest = totalPayable - amount;

  return (
    <section id="emi" className="bg-background py-24">
      <div className="container-prose grid gap-12 rounded-2xl border border-border bg-card p-8 shadow-soft md:grid-cols-2 md:p-12">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            EMI Calculator
          </p>
          <h2 className="mt-3 font-display text-4xl leading-tight md:text-5xl">
            Calculate your EMI.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Move the sliders to estimate your monthly outflow. Final rates depend
            on the lender, your business profile and tenure.
          </p>

          <div className="mt-8 space-y-7">
            <Field
              label="Loan amount"
              value={inr(amount)}
              control={
                <Slider
                  value={[amount]}
                  min={500_000}
                  max={10_000_000}
                  step={50_000}
                  onValueChange={([v]) => setAmount(v)}
                />
              }
            />
            <Field
              label="Interest rate"
              value={`${rate.toFixed(1)}% p.a.`}
              control={
                <Slider
                  value={[rate]}
                  min={9}
                  max={24}
                  step={0.1}
                  onValueChange={([v]) => setRate(v)}
                />
              }
            />
            <Field
              label="Tenure"
              value={`${tenure} months`}
              control={
                <Slider
                  value={[tenure]}
                  min={6}
                  max={84}
                  step={1}
                  onValueChange={([v]) => setTenure(v)}
                />
              }
            />
          </div>
        </div>

        <div className="flex flex-col justify-between gap-8 rounded-xl bg-ink p-8 text-ink-foreground">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-ink-foreground/60">
              Monthly EMI
            </p>
            <p className="mt-3 font-display text-6xl text-gold">{inr(emi)}</p>

            <dl className="mt-8 grid grid-cols-2 gap-6 border-t border-ink-foreground/10 pt-6">
              <Stat label="Principal" value={inr(amount)} />
              <Stat label="Total interest" value={inr(totalInterest)} />
              <Stat label="Total payable" value={inr(totalPayable)} />
              <Stat label="Tenure" value={`${tenure} mo`} />
            </dl>
          </div>

          <Button variant="gold" size="lg" className="w-full">
            Check Eligibility
          </Button>
        </div>
      </div>
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
        <Label className="text-sm text-muted-foreground">{label}</Label>
        <span className="font-display text-xl">{value}</span>
      </div>
      <div className="mt-3">{control}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-ink-foreground/60">
        {label}
      </dt>
      <dd className="mt-1 font-display text-xl">{value}</dd>
    </div>
  );
}
