import { AnnouncementBar, SiteHeader, SiteFooter } from "@/website/components/layout";
import {
  Hero,
  LoanProducts,
  WhyNavdhan,
  EmiCalculator,
  Stories,
  Recognition,
  CtaBand,
} from "@/website/components/sections";
import { LanguageProvider } from "@/website/i18n";

/** The Navdhan marketing landing page. */
export function Home() {
  return (
    <LanguageProvider>
      <div className="min-h-screen bg-paper text-ink">
        <AnnouncementBar />
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
    </LanguageProvider>
  );
}
