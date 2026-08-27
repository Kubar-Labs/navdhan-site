import { MarketingFooter, MarketingHeader } from "@/src/components/marketing/MarketingChrome";
import { isValidLocale } from "@/src/lib/i18n/config";
import { notFound } from "next/navigation";

interface MarketingLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function MarketingLayout({ children, params }: MarketingLayoutProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <MarketingHeader locale={locale} />
      <main id="main-content">{children}</main>
      <MarketingFooter locale={locale} />
    </>
  );
}
