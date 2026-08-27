import { Header } from "@/src/components/shells/Header";

interface ApplyLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function ApplyLayout({ children, params }: ApplyLayoutProps) {
  const { locale } = await params;

  return (
    <>
      <Header currentLocale={locale} />
      <main id="main-content" className="min-h-screen bg-nt-cream">
        {children}
      </main>
    </>
  );
}
