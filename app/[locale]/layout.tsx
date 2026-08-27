import "../globals.css";
import localFont from "next/font/local";
import { notFound } from "next/navigation";
import { AgentationDevtools } from "@/src/components/dev/AgentationDevtools";
import { isValidLocale } from "@/src/lib/i18n/config";

const inter = localFont({
  src: [
    { path: "../fonts/inter-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/inter-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/inter-600.woff2", weight: "600", style: "normal" },
    { path: "../fonts/inter-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
  fallback: ["Noto Sans Devanagari", "system-ui", "sans-serif"],
});

const instrumentSerif = localFont({
  src: "../fonts/instrument-serif.woff2",
  weight: "400",
  style: "normal",
  variable: "--font-safira-march",
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
      className={`${inter.variable} ${instrumentSerif.variable} --font-inter --font-safira-march --font-instrument-serif`}
    >
      <body className="bg-nt-cream text-nt-slate-900 antialiased">
        {children}
        <AgentationDevtools />
      </body>
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
