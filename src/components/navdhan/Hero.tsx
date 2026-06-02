import { Button } from "@/components/ui/button";
import navdhanFlow from "@/assets/navdhan-flow.png";

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
            NavDhan by Kubar Labs powers embedded lending for the next generation of MSME finance. We connect{" "}
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
          <div className="relative overflow-hidden rounded-2xl border border-border bg-white p-4 shadow-elegant">
            <img
              src={navdhanFlow}
              alt="NavDhan Smart Credit Infrastructure Flow diagram showing connections between lenders, marketplaces, and data rails like GST and Account Aggregator"
              width={1024}
              height={1024}
              className="w-full h-auto max-h-[500px] md:max-h-[560px] rounded-xl object-contain"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
