import { Banknote, Wallet, Factory, TrendingUp } from "lucide-react";

const PRODUCTS = [
  {
    icon: Banknote,
    title: "Collateral-Free Term Loans",
    description: "Unsecured funding up to ₹50 Lakhs based on business cash flow.",
    colorClass: "bg-brand-green-light text-brand-green",
  },
  {
    icon: Wallet,
    title: "Working Capital Loans",
    description: "Bridge cash-flow gaps with flexible drawdown and repayment.",
    colorClass: "bg-brand-orange-light text-brand-orange",
  },
  {
    icon: Factory,
    title: "Asset Financing",
    description: "Fund machinery, equipment and vehicles with tailored EMIs.",
    colorClass: "bg-brand-blue-light text-brand-blue",
  },
  {
    icon: TrendingUp,
    title: "MSME Growth Capital",
    description: "Scale-stage capital aligned with priority sector norms.",
    colorClass: "bg-brand-green-light text-brand-green",
  },
];

export function LoanProducts() {
  return (
    <section id="products" className="border-y border-border bg-white py-24">
      <div className="container-prose grid gap-14 md:grid-cols-[1fr_1.2fr] md:items-center">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-brand-blue font-semibold">
            Loan Products
          </p>
          <h2 className="mt-4 font-display text-4xl leading-tight text-balance md:text-5xl text-brand-navy">
            Tailored loan products to match{" "}
            <span className="bg-brand-orange-light border-b border-brand-orange/30 px-1.5 py-0.5 rounded text-brand-navy">your specific business needs.</span>
          </h2>
          <p className="mt-6 max-w-md text-muted-foreground">
            Whether you're buying equipment, funding payroll, or expanding to a
            new city — we route your application to the right lender, the first
            time.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {PRODUCTS.map(({ icon: Icon, title, description, colorClass }) => (
            <article
              key={title}
              className="group rounded-xl border border-border bg-card p-6 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-blue/30 hover:shadow-elegant"
            >
              <div className={`flex size-10 items-center justify-center rounded-lg ${colorClass} transition-colors group-hover:scale-105`}>
                <Icon className="size-5" aria-hidden />
              </div>
              <h3 className="mt-5 font-display text-2xl text-brand-navy">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
