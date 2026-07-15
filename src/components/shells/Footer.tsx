import Link from "next/link";
import { Container } from "@/src/components/layout/Container";
import { Logo } from "@/src/components/shells/Logo";
import { legalSlugs } from "@/src/lib/legal/loader";
import { getTranslator } from "@/src/lib/i18n/translations";

function legalLabel(slug: string): string {
  if (slug === "rbi-dlg-disclosure") return "RBI DLG Disclosure";
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

interface FooterProps {
  locale: string;
}

export async function Footer({ locale }: FooterProps) {
  const t = await getTranslator(locale);

  const company = t("global.footer.company");
  const address = t("global.footer.address");
  const tagline = t("global.footer.tagline");
  const copyright = t("global.footer.copyright");

  return (
    <footer className="bg-nt-slate-900 py-16 text-white">
      <Container>
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <Link
              href={`/${locale}`}
              className="focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nt-orange-600"
            >
              <Logo variant="light" />
            </Link>
            <div className="mt-4 text-base font-bold text-white">NavDhan</div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-nt-slate-300">{tagline}</p>
            <p className="mt-6 text-xs text-nt-slate-400">{copyright}</p>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-nt-slate-400">
              {t("global.footer.companyHeading")}
            </p>
            <ul className="mt-4 space-y-3 text-sm text-nt-slate-300">
              <li>
                <Link
                  href={`/${locale}/team`}
                  className="block text-sm text-nt-slate-300 hover:text-white transition-colors"
                >
                  {t("global.nav.team")}
                </Link>
              </li>
              <li>
                <a
                  href="mailto:hello@kubar.tech"
                  className="hover:text-white focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nt-orange-600"
                >
                  Contact
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-nt-slate-400">
              {t("global.footer.contactHeading")}
            </p>
            <ul className="mt-4 space-y-3 text-sm text-nt-slate-300">
              <li>
                <a
                  href={`mailto:${t("global.contact.loan")}`}
                  className="hover:text-white transition-colors"
                >
                  Loan Enquiry
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${t("global.contact.partnership")}`}
                  className="hover:text-white transition-colors"
                >
                  Partnership Enquiry
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${t("global.contact.outreach")}`}
                  className="hover:text-white transition-colors"
                >
                  Talk to Us
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${t("global.contact.support")}`}
                  className="hover:text-white transition-colors"
                >
                  Support
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${t("global.contact.careers")}`}
                  className="hover:text-white transition-colors"
                >
                  Careers
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${t("global.contact.press")}`}
                  className="hover:text-white transition-colors"
                >
                  Press
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-nt-slate-400">
              {t("global.footer.legalHeading")}
            </p>
            <ul className="mt-4 space-y-3 text-sm text-nt-slate-300">
              {legalSlugs.map((slug) => (
                <li key={slug}>
                  <Link
                    href={`/${locale}/legal/${slug}`}
                    className="hover:text-white focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nt-orange-600"
                  >
                    {legalLabel(slug)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-nt-slate-800 pt-8 text-xs leading-relaxed text-nt-slate-400">
          <p>{company}</p>
          <p className="mt-1">{address}</p>
        </div>
      </Container>
    </footer>
  );
}
