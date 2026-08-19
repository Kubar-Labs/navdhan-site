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
  const announcementHref = tGlobal("announcement.href");

  const navLinks = [
    { label: tNav("loanProducts"), href: `/${locale}/#products` },
    { label: tNav("whyNavDhan"), href: `/${locale}/#why` },
    { label: tNav("emiCalculator"), href: `/${locale}/#emi` },
    { label: tNav("team"), href: `/${locale}/team` },
  ];

  return (
    <>
      <AnnouncementBar
        message={tGlobal("announcement.message")}
        ctaLabel={tGlobal("announcement.ctaLabel")}
        href={announcementHref === "/apply" ? `/${locale}/apply` : announcementHref}
        dismissLabel={tGlobal("announcement.dismissLabel")}
      />
      <Header
        navLinks={navLinks}
        cta={{
          label: tGlobal("cta.apply.label"),
          href: `/${locale}/apply`,
          variant: "primary",
        }}
        currentLocale={locale}
        skipToContentLabel={tGlobal("skipToContent")}
        primaryNavigationLabel={tGlobal("nav.ariaLabel")}
        languageSelectorLabel={tGlobal("localeSelector.label")}
        mobileMenuOpenLabel={tGlobal("mobileMenu.open")}
        mobileMenuCloseLabel={tGlobal("mobileMenu.close")}
        mobileNavigationLabel={tGlobal("mobileMenu.ariaLabel")}
      />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <Footer locale={locale} />
    </>
  );
}
