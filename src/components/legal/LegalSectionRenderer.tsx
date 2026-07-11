import Link from "next/link";
import { LegalTable } from "./LegalTable";
import type {
  LegalSection,
  ProseLegalSection,
  ListLegalSection,
  TableLegalSection,
  ContactLegalSection,
  LegalCrossLink,
} from "@/src/types/legal";

export interface LegalSectionRendererProps {
  section: LegalSection;
  locale?: string;
}

function localizeHref(href: string, locale: string): string {
  if (href.startsWith("/legal/")) {
    return `/${locale}${href}`;
  }
  return href;
}

function CrossLinkNode({ link, locale }: { link: LegalCrossLink; locale: string }) {
  return (
    <p className="mt-4">
      <Link
        href={localizeHref(`/legal/${link.slug}`, locale)}
        className="font-medium text-nt-orange-600 underline underline-offset-2 hover:text-nt-orange-700 focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nt-orange-600"
      >
        {link.label}
      </Link>
    </p>
  );
}

export function LegalSectionRenderer({ section, locale = "en" }: LegalSectionRendererProps) {
  switch (section.content_type) {
    case "prose":
      return <ProseSection section={section} locale={locale} />;
    case "list":
      return <ListSection section={section} />;
    case "table":
      return <TableSection section={section} />;
    case "contact_card":
      return <ContactSection section={section} locale={locale} />;
    default:
      return null;
  }
}

interface ProseSectionProps {
  section: ProseLegalSection;
  locale: string;
}

function ProseSection({ section, locale }: ProseSectionProps) {
  return (
    <section id={section.id} className="scroll-mt-24">
      <h2 className="mb-4 text-2xl font-semibold tracking-tight text-nt-slate-900">
        {section.title}
      </h2>
      <p className="max-w-prose text-base leading-relaxed text-nt-slate-700">{section.body}</p>
      {section.cross_link && <CrossLinkNode link={section.cross_link} locale={locale} />}
    </section>
  );
}

interface ListSectionProps {
  section: ListLegalSection;
}

function ListSection({ section }: ListSectionProps) {
  return (
    <section id={section.id} className="scroll-mt-24">
      <h2 className="mb-4 text-2xl font-semibold tracking-tight text-nt-slate-900">
        {section.title}
      </h2>
      <ul className="space-y-4">
        {section.items.map((item, index) => (
          <li key={index}>
            <strong className="block text-nt-slate-900">{item.heading}</strong>
            <span className="max-w-prose text-base leading-relaxed text-nt-slate-700">
              {item.body}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface TableSectionProps {
  section: TableLegalSection;
}

function TableSection({ section }: TableSectionProps) {
  return (
    <section id={section.id} className="scroll-mt-24">
      <h2 className="mb-4 text-2xl font-semibold tracking-tight text-nt-slate-900">
        {section.title}
      </h2>
      <LegalTable
        caption={section.table.caption}
        headers={section.table.headers}
        rows={section.table.rows}
      />
    </section>
  );
}

interface ContactSectionProps {
  section: ContactLegalSection;
  locale: string;
}

function ContactSection({ section, locale }: ContactSectionProps) {
  return (
    <section id={section.id} className="scroll-mt-24">
      <h2 className="mb-4 text-2xl font-semibold tracking-tight text-nt-slate-900">
        {section.title}
      </h2>
      <address className="not-italic rounded-lg border border-nt-slate-200 bg-nt-cream/50 p-6">
        <p className="font-semibold text-nt-slate-900">{section.contact.name}</p>
        <p className="text-nt-slate-700">{section.contact.role}</p>
        <p className="mt-2">
          <a
            href={`mailto:${section.contact.email}`}
            className="font-medium text-nt-orange-600 underline underline-offset-2 hover:text-nt-orange-700 focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nt-orange-600"
          >
            {section.contact.email}
          </a>
        </p>
        <p className="mt-2 whitespace-pre-line text-nt-slate-700">{section.contact.address}</p>
      </address>
      {section.cross_link && <CrossLinkNode link={section.cross_link} locale={locale} />}
    </section>
  );
}
