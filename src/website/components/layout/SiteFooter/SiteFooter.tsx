import ndLogo from "@/assets/nd-logo.png";
import { useT } from "@/website/i18n";
import { FOOTER_HREFS } from "./content";

export function SiteFooter() {
  const t = useT();
  const year = new Date().getFullYear();

  return (
    <footer className="bg-abyss text-white/80">
      <div className="container-prose grid gap-12 py-16 md:grid-cols-[1.4fr_repeat(3,1fr)] md:py-20">
        <div>
          <img src={ndLogo} alt="Navdhan by Kubar Labs" className="h-12 w-auto object-contain" />
          <p className="mt-5 max-w-xs text-body-sm text-white/55">{t.footer.tagline}</p>
          <div className="mt-8 space-y-1 text-body-sm text-white/55">
            <p className="text-caption font-medium uppercase tracking-[0.1em] text-white/40">
              {t.footer.company}
            </p>
            <p>{t.footer.office}</p>
            <a
              href="https://kubarlabs.com"
              className="inline-block pt-2 font-medium text-ember transition-colors hover:text-ember-hover"
            >
              kubarlabs.com →
            </a>
          </div>
        </div>

        {t.footer.columns.map((col, ci) => (
          <div key={col.title}>
            <p className="text-body-sm font-semibold text-white">{col.title}</p>
            <ul className="mt-4 space-y-2.5 text-body-sm">
              {col.items.map((label, ii) => (
                <li key={label}>
                  <a
                    href={FOOTER_HREFS[ci]?.[ii] ?? "#"}
                    className="text-white/55 transition-colors hover:text-white"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10">
        <div className="container-prose flex flex-col items-start justify-between gap-2 py-6 text-caption text-white/45 md:flex-row md:items-center">
          <p>
            © {year} Kubar Labs. {t.footer.rights}
          </p>
          <p>{t.footer.badges}</p>
        </div>
      </div>
    </footer>
  );
}
