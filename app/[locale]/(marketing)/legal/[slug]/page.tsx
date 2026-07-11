import { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadLegalPage, legalSlugs, type LegalSlug } from "@/src/lib/legal/loader";
import { LegalPageShell } from "@/src/components/legal/LegalPageShell";

interface LegalPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: LegalPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  try {
    const page = await loadLegalPage(locale, slug);
    return {
      title: page.meta.title,
      description: page.meta.description,
    };
  } catch {
    return { title: "Legal — NavDhan" };
  }
}

export default async function LegalPage({ params }: LegalPageProps) {
  const { locale, slug } = await params;
  const page = await loadLegalPage(locale, slug);

  return <LegalPageShell page={page} locale={locale} slug={slug} />;
}

export function generateStaticParams() {
  const params: { locale: string; slug: LegalSlug }[] = [];
  const locales = ["en", "hi", "bn", "te", "mr", "ta", "kn", "ml"];
  for (const locale of locales) {
    for (const slug of legalSlugs) {
      params.push({ locale, slug });
    }
  }
  return params;
}
