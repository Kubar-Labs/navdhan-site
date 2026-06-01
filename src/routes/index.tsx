import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/navdhan/SiteHeader";
import { Hero } from "@/components/navdhan/Hero";
import { LoanProducts } from "@/components/navdhan/LoanProducts";
import { WhyNavdhan } from "@/components/navdhan/WhyNavdhan";
import { EmiCalculator } from "@/components/navdhan/EmiCalculator";
import { Stories } from "@/components/navdhan/Stories";
import { Recognition } from "@/components/navdhan/Recognition";
import { CtaBand } from "@/components/navdhan/CtaBand";
import { SiteFooter } from "@/components/navdhan/SiteFooter";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Navdhan — Fuel your business growth with the right loan" },
      {
        name: "description",
        content:
          "A loan marketplace by Kubar Labs. Compare offers from 20+ NBFCs and Cooperative Banks with a single application. ₹5L to ₹1Cr+, approvals in 24h–7d.",
      },
      { property: "og:title", content: "Navdhan — Business loans, one application" },
      {
        property: "og:description",
        content:
          "Compare offers from 20+ NBFCs and Cooperative Banks with one application. Zero platform fee. RBI aligned, FACE registered.",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main>
        <Hero />
        <LoanProducts />
        <WhyNavdhan />
        <EmiCalculator />
        <Stories />
        <Recognition />
        <CtaBand />
      </main>
      <SiteFooter />
    </div>
  );
}
