import { Header } from "@/src/components/shells/Header";
import { Footer } from "@/src/components/shells/Footer";
import { AnnouncementBar } from "@/src/components/shells/AnnouncementBar";
import { getTranslator } from "@/src/lib/i18n/translations";

interface MarketingLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function MarketingLayout({ children, params }: MarketingLayoutProps) {
  const { locale } = await params;
  const tNav = await getTranslator(locale, "global.nav");
  const tGlobal = await getTranslator(locale, "global");

  const navLinks = [
    { label: tNav("loanProducts"), href: `/${locale}/#products` },
    { label: tNav("whyNavDhan"), href: `/${locale}/#why` },
    { label: tNav("emiCalculator"), href: `/${locale}/#emi` },
    { label: tNav("customerStories"), href: `/${locale}/#stories` },
    { label: tNav("team"), href: `/${locale}/team` },
  ];

  return (
    <>
      <AnnouncementBar
        message={tGlobal("announcement.message")}
        ctaLabel={tGlobal("announcement.ctaLabel")}
        href={tGlobal("announcement.href")}
      />
      <Header
        navLinks={navLinks}
        cta={{ label: tGlobal("cta.apply.label"), href: `/${locale}/apply`, variant: "primary" }}
        currentLocale={locale}
      />
      <main id="main-content">{children}</main>
      <Footer locale={locale} />
    </>
  );
}
