import "../globals.css";
import { Inter, Instrument_Serif } from "next/font/google";
import { notFound } from "next/navigation";
import { isValidLocale } from "@/src/lib/i18n/config";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
  fallback: ["Noto Sans Devanagari", "system-ui", "sans-serif"],
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["italic"],
  variable: "--font-instrument-serif",
  display: "swap",
  fallback: ["Georgia", "serif"],
});

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) {
    notFound();
  }
  return (
    <html
      lang={locale}
      className={`${inter.variable} ${instrumentSerif.variable} --font-inter --font-instrument-serif`}
    >
      <body className="bg-nt-cream text-nt-slate-900 antialiased">{children}</body>
    </html>
  );
}

export function generateStaticParams() {
  return [
    { locale: "en" },
    { locale: "hi" },
    { locale: "bn" },
    { locale: "te" },
    { locale: "mr" },
    { locale: "ta" },
    { locale: "kn" },
    { locale: "ml" },
  ];
}
