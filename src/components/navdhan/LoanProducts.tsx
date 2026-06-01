import { Banknote, Wallet, Factory, TrendingUp } from "lucide-react";

const PRODUCTS = [
  {
    icon: Banknote,
    title: "Collateral-Free Term Loans",
    description: "Unsecured funding up to ₹50 Lakhs based on business cash flow.",
  },
  {
    icon: Wallet,
    title: "Working Capital Loans",
    description: "Bridge cash-flow gaps with flexible drawdown and repayment.",
  },
  {
    icon: Factory,
    title: "Asset Financing",
    description: "Fund machinery, equipment and vehicles with tailored EMIs.",
  },
  {
    icon: TrendingUp,
    title: "MSME Growth Capital",
    description: "Scale-stage capital aligned with priority sector norms.",
  },
];

export function LoanProducts() {
  return (
    <section id="products" className="border-y border-border bg-background py-24">
      <div className="container-prose grid gap-14 md:grid-cols-[1fr_1.2fr] md:items-center">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Loan Products
          </p>
          <h2 className="mt-4 font-display text-4xl leading-tight text-balance md:text-5xl">
            Tailored loan products to match{" "}
            <span className="bg-gold/25 px-1.5">your specific business needs.</span>
          </h2>
          <p className="mt-6 max-w-md text-muted-foreground">
            Whether you're buying equipment, funding payroll, or expanding to a
            new city — we route your application to the right lender, the first
            time.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {PRODUCTS.map(({ icon: Icon, title, description }) => (
            <article
              key={title}
              className="group rounded-xl border border-border bg-card p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:border-gold/60"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Icon className="size-5" aria-hidden />
              </div>
              <h3 className="mt-5 font-display text-2xl">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
