import Link from "next/link";
import { MarketingContainer } from "@/src/components/marketing/MarketingUI";
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
    <footer className="bg-nt-slate-900 py-12 text-white lg:py-16">
      <MarketingContainer>
        <div className="grid gap-12 lg:grid-cols-[1.25fr_2fr] lg:gap-16">
          <div>
            <Link
              href={`/${locale}`}
              className="focus-visible:rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nt-orange-600"
            >
              <Logo variant="light" />
            </Link>
            <p className="mt-4 max-w-sm text-base leading-6 text-nt-slate-300">
              One origination layer for businesses, B2B platforms, and regulated lenders.
            </p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.08em] text-nt-orange-400">
              Powered by Kubar Labs
            </p>
            <p className="mt-6 max-w-md text-xs leading-5 text-nt-slate-400">{tagline}</p>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-nt-orange-400">
                Product
              </p>
              <ul className="mt-4 space-y-3 text-sm text-nt-slate-300">
                <li>
                  <Link href={`/${locale}`} className="hover:text-white">
                    For Borrowers
                  </Link>
                </li>
                <li>
                  <Link href={`/${locale}/platforms`} className="hover:text-white">
                    For Platforms
                  </Link>
                </li>
                <li>
                  <Link href={`/${locale}/lenders`} className="hover:text-white">
                    For Lenders
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-nt-orange-400">
                Company
              </p>
              <ul className="mt-4 space-y-3 text-sm text-nt-slate-300">
                <li>
                  <Link href={`/${locale}/#top`} className="hover:text-white">
                    About
                  </Link>
                </li>
                <li>
                  <Link href={`/${locale}/team`} className="hover:text-white">
                    {t("global.nav.team")}
                  </Link>
                </li>
                <li>
                  <a href="mailto:hello@kubar.tech" className="hover:text-white">
                    Contact
                  </a>
                </li>
              </ul>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-nt-orange-400">
                Legal
              </p>
              <ul className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 text-sm text-nt-slate-300 sm:grid-cols-1">
                {legalSlugs.map((slug) => (
                  <li key={slug}>
                    <Link href={`/${locale}/legal/${slug}`} className="hover:text-white">
                      {legalLabel(slug)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-nt-slate-700 pt-8 text-xs leading-5 text-nt-slate-400">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p>{company}</p>
              <p className="mt-1">{address}</p>
              <p className="mt-3">{copyright}</p>
            </div>
            <p>Responsible lending · Consent-led data use</p>
          </div>
        </div>
      </MarketingContainer>
    </footer>
  );
}
