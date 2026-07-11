import { Header } from "@/src/components/shells/Header";
import { getTranslator } from "@/src/lib/i18n/translations";

interface ApplyLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function ApplyLayout({ children, params }: ApplyLayoutProps) {
  const { locale } = await params;
  const t = await getTranslator(locale, "global");

  return (
    <>
      <Header
        navLinks={[{ label: t("cta.backToHome"), href: `/${locale}` }]}
        cta={{
          label: t("contact.support"),
          href: "mailto:support@kubar.tech",
          variant: "secondary",
        }}
        currentLocale={locale}
      />
      <main id="main-content" className="min-h-screen bg-nt-cream">
        {children}
      </main>
    </>
  );
}
