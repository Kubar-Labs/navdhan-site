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
    <section id="why" className="bg-white py-24 border-b border-border">
      <div className="container-prose">
        <div className="grid gap-12 lg:grid-cols-[1fr_2fr] lg:items-center">
          <div className="space-y-6">
            <p className="text-xs uppercase tracking-[0.22em] text-brand-blue font-semibold">
              Why Navdhan
            </p>
            <h2 className="font-display text-4xl leading-tight md:text-5xl text-brand-navy">
              Built for founders who don't have time to chase paperwork.
            </h2>
            <Button variant="blue" className="mt-2">
              Apply Loan
            </Button>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {REASONS.map(({ icon: Icon, title, description }) => (
              <li key={title} className="bg-card border border-border p-6 rounded-xl shadow-soft hover:shadow-elegant hover:border-brand-blue/30 transition-all duration-300">
                <div className="flex size-10 items-center justify-center rounded-lg bg-brand-green-light text-brand-green mb-4">
                  <Icon className="size-5" aria-hidden />
                </div>
                <h3 className="font-display text-xl text-brand-navy">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{description}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-20 border-y border-brand-blue/10 bg-brand-blue py-5">
        <div className="container-prose flex flex-wrap items-center justify-center gap-x-10 gap-y-2 text-xs uppercase tracking-[0.28em] text-white font-medium">
          <span>RBI Aligned</span>
          <span className="text-brand-orange font-bold text-sm">◆</span>
          <span>20+ Lenders</span>
          <span className="text-brand-orange font-bold text-sm">◆</span>
          <span>FACE Registered</span>
        </div>
      </div>
    </section>
  );
}
