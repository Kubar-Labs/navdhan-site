import { Header } from "@/src/components/shells/Header";
import { Footer } from "@/src/components/shells/Footer";

interface MarketingLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function MarketingLayout({ children, params }: MarketingLayoutProps) {
  const { locale } = await params;

  return (
    <>
      <Header currentLocale={locale} />
      <main id="main-content">{children}</main>
      <Footer locale={locale} />
    </>
  );
}
