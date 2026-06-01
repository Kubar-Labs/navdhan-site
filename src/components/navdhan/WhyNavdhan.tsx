import {
  Network,
  Layers,
  GitCompareArrows,
  Zap,
  MousePointerClick,
  BadgeIndianRupee,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const REASONS = [
  {
    icon: Network,
    title: "Wide Lender Network",
    description: "Access offers from 20+ verified NBFC partners and Cooperative Banks.",
  },
  {
    icon: Layers,
    title: "Flexible Ticket Sizes",
    description: "Loans available from ₹5 Lakhs to ₹1 Crore+.",
  },
  {
    icon: GitCompareArrows,
    title: "Multiple Offers, One Application",
    description: "Compare and choose the best interest rates without multiple entries.",
  },
  {
    icon: Zap,
    title: "Fast Processing",
    description: "Get loan approvals in as little as 24 hours to 7 days.",
  },
  {
    icon: MousePointerClick,
    title: "Simple Online Process",
    description: "A fully digital, hassle-free application.",
  },
  {
    icon: BadgeIndianRupee,
    title: "Zero Platform Fee",
    description: "Pay no additional fee to us — only what the lender charges you.",
  },
];

export function WhyNavdhan() {
  return (
    <section id="why" className="bg-secondary py-24">
      <div className="container-prose">
        <div className="grid gap-10 md:grid-cols-[1fr_2fr] md:items-end">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
              Why Navdhan
            </p>
            <h2 className="mt-4 font-display text-4xl leading-tight md:text-5xl">
              Built for founders who don't have time to chase paperwork.
            </h2>
            <Button variant="ink" className="mt-8">
              Apply Loan
            </Button>
          </div>

          <ul className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {REASONS.map(({ icon: Icon, title, description }) => (
              <li key={title} className="bg-card p-6">
                <Icon className="size-5 text-gold" aria-hidden />
                <h3 className="mt-4 font-display text-xl">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{description}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-20 border-y border-border bg-ink py-5">
        <div className="container-prose flex flex-wrap items-center justify-center gap-x-10 gap-y-2 text-xs uppercase tracking-[0.28em] text-ink-foreground/80">
          <span>RBI Aligned</span>
          <span className="text-gold/60">◆</span>
          <span>20+ Lenders</span>
          <span className="text-gold/60">◆</span>
          <span>FACE Registered</span>
        </div>
      </div>
    </section>
  );
}
