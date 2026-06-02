import { Button } from "@/components/ui/button";
import { ShoppingBag, Cpu, Building2 } from "lucide-react";

function CreditFlowVisualizer() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-slate-50/40 p-8 shadow-soft">
      <div className="flex flex-col gap-6">
        <div>
          <h4 className="font-display text-xl text-brand-navy font-semibold">How NavDhan Works</h4>
          <p className="text-sm text-muted-foreground mt-1">
            An embedded credit hub connecting B2B platforms and lenders.
          </p>
        </div>

        {/* Step 1 */}
        <div className="relative flex gap-4 items-start">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-blue-light text-brand-blue">
            <ShoppingBag className="size-5" />
          </div>
          <div>
            <h5 className="text-sm font-semibold text-brand-navy">1. Embedded Integration</h5>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              NavDhan embeds directly into B2B marketplaces and platforms. Borrowers apply
              seamlessly within their daily workflows.
            </p>
          </div>
        </div>

        {/* Connector Line 1 */}
        <div className="ml-5 h-6 w-0.5 bg-border -my-2" />

        {/* Step 2 */}
        <div className="relative flex gap-4 items-start">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-orange-light text-brand-orange">
            <Cpu className="size-5" />
          </div>
          <div>
            <h5 className="text-sm font-semibold text-brand-navy">
              2. Smart Matching (&lt; 5 Mins)
            </h5>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Aggregates consent-backed GST and Account Aggregator data to qualify leads inside our
              BRE in under 5 minutes.
            </p>
          </div>
        </div>

        {/* Connector Line 2 */}
        <div className="ml-5 h-6 w-0.5 bg-border -my-2" />

        {/* Step 3 */}
        <div className="relative flex gap-4 items-start">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-green-light text-brand-green">
            <Building2 className="size-5" />
          </div>
          <div>
            <h5 className="text-sm font-semibold text-brand-navy">3. Lender Routing & Disbursal</h5>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              BRE-qualified leads match with 20+ partner banks/NBFCs, delivering a 40–45% approval
              rate (vs. 15-20% standard).
            </p>
          </div>
        </div>

        {/* Monetization note */}
        <div className="mt-4 border-t border-border pt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
          <span>
            Fee: <strong className="text-brand-navy font-semibold">1.25% on disbursals</strong>
          </span>
          <span className="hidden sm:inline h-1.5 w-1.5 rounded-full bg-brand-green" />
          <span>
            Platform Cost: <strong className="text-brand-navy font-semibold">100% Free</strong>
          </span>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-white">
      <div className="container-prose grid gap-12 py-20 md:grid-cols-[1fr_1.1fr] md:items-center md:py-28">
        <div className="space-y-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs uppercase tracking-[0.18em] text-muted-foreground shadow-sm">
            <span className="size-1.5 rounded-full bg-brand-green" />
            Smart Credit Infrastructure for Bharat
          </span>

          <h1 className="font-display text-5xl leading-[1.05] text-balance md:text-6xl lg:text-7xl text-brand-navy">
            Embedded lending for India's <span className="italic text-brand-blue">MSMEs.</span>
          </h1>

          <p className="max-w-xl text-lg text-muted-foreground">
            NavDhan by Kubar Labs powers embedded lending for the next generation of MSME finance.
            We connect{" "}
            <span className="bg-brand-orange/10 border-b border-brand-orange/30 px-1.5 py-0.5 rounded font-medium text-brand-navy">
              lenders, marketplaces, and platforms
            </span>{" "}
            in one place to make credit flow where business actually happens.
          </p>

          <div className="flex flex-wrap gap-3">
            <Button size="lg" variant="orange">
              Book a Demo
            </Button>
            <Button size="lg" variant="outline-blue">
              Explore Use Cases
            </Button>
          </div>

          <dl className="grid grid-cols-3 gap-6 border-t border-border pt-8 text-left">
            {[
              { label: "Lender partners", value: "20+", colorClass: "text-brand-green" },
              { label: "Data integrations", value: "GST & AA", colorClass: "text-brand-blue" },
              { label: "Decisioning", value: "Real-time", colorClass: "text-brand-orange" },
            ].map((stat) => (
              <div key={stat.label}>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                  {stat.label}
                </dt>
                <dd className={`mt-1 font-display text-2xl md:text-3xl ${stat.colorClass}`}>
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative md:-mt-12 md:translate-y-[-8px]">
          <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-brand-blue/20 via-brand-green/10 to-transparent blur-2xl" />
          <CreditFlowVisualizer />
        </div>
      </div>
    </section>
  );
}
