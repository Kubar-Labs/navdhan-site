import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-network.jpg";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-cream">
      <div className="container-prose grid gap-12 py-20 md:grid-cols-[1.1fr_1fr] md:items-center md:py-28">
        <div className="space-y-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-gold" />
            Loan Marketplace for Bharat
          </span>

          <h1 className="font-display text-5xl leading-[1.05] text-balance md:text-6xl lg:text-7xl">
            Fuel your business growth with the{" "}
            <span className="italic text-foreground/90">right loan.</span>
          </h1>

          <p className="max-w-xl text-lg text-muted-foreground">
            Choose the right loan for you from multiple offers by{" "}
            <span className="bg-gold/25 px-1.5 font-medium text-foreground">
              20+ top NBFCs and Cooperative Banks
            </span>{" "}
            with just one single application.
          </p>

          <div className="flex flex-wrap gap-3">
            <Button size="lg" variant="ink">
              Get Offers
            </Button>
            <Button size="lg" variant="outline-ink">
              Check Eligibility
            </Button>
          </div>

          <dl className="grid grid-cols-3 gap-6 border-t border-border pt-8 text-left">
            {[
              { label: "Lender partners", value: "20+" },
              { label: "Loan range", value: "₹5L–1Cr+" },
              { label: "Approval window", value: "24h–7d" },
            ].map((stat) => (
              <div key={stat.label}>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                  {stat.label}
                </dt>
                <dd className="mt-1 font-display text-3xl text-foreground">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-gold/30 via-transparent to-transparent blur-2xl" />
          <div className="relative overflow-hidden rounded-2xl border border-border bg-ink shadow-elegant">
            <img
              src={heroImage}
              alt="Network of lender partners connected through Navdhan"
              width={1280}
              height={1024}
              className="aspect-square w-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
