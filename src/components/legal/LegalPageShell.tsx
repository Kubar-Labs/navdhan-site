import { Container } from "@/src/components/layout/Container";
import { LegalSectionRenderer } from "./LegalSectionRenderer";
import { LegalTableOfContents } from "./LegalTableOfContents";
import type { LegalPageContent, LegalTocEntry } from "@/src/types/legal";

export interface LegalPageShellProps {
  page: LegalPageContent;
  locale: string;
  slug: string;
}

function formatLastUpdated(dateString: string, locale: string): string {
  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat(locale.replace(/_/g, "-"), {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  } catch {
    return dateString;
  }
}

export function LegalPageShell({ page, locale }: LegalPageShellProps) {
  const tocEntries: LegalTocEntry[] = page.sections.map((section) => ({
    id: section.id,
    title: section.title,
  }));

  return (
    <>
      <header className="bg-nt-cream py-12 md:py-16">
        <Container size="legal">
          <h1 className="max-w-[65ch] text-3xl font-semibold tracking-tight text-nt-slate-900 md:text-4xl">
            {page.intro.heading}
          </h1>
          <p className="mt-2 text-sm font-medium text-nt-slate-600">
            Last updated{" "}
            <time dateTime={page.lastUpdated}>{formatLastUpdated(page.lastUpdated, locale)}</time>
          </p>
          <p className="mt-6 max-w-[65ch] text-base leading-relaxed text-nt-slate-700 md:text-lg">
            {page.intro.body}
          </p>
        </Container>
      </header>

      <section className="py-12 md:py-16">
        <Container size="legal">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
            <article className="order-2 lg:order-1 lg:col-span-8">
              <div className="space-y-12 md:space-y-14">
                {page.sections.map((section) => (
                  <LegalSectionRenderer key={section.id} section={section} locale={locale} />
                ))}
              </div>
            </article>

            <aside className="order-1 lg:order-2 lg:col-span-4">
              <div className="sticky top-24">
                <LegalTableOfContents sections={tocEntries} />
              </div>
            </aside>
          </div>
        </Container>
      </section>
    </>
  );
}
