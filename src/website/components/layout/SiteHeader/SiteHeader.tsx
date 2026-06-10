import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import ndLogo from "@/assets/nd-logo.png";
import { useT, LanguageSwitcher } from "@/website/i18n";
import { APPLY_URL } from "@/website/config";
import { NAV_HREFS } from "./content";

export function SiteHeader() {
  const t = useT();

  return (
    <header className="sticky top-0 z-50 border-b border-mist bg-paper/85 backdrop-blur-md">
      <div className="container-prose flex h-[4.5rem] items-center justify-between gap-4">
        <Link to="/" className="flex items-center" aria-label="Navdhan home">
          <span className="inline-flex items-center rounded-xl bg-ink px-3 py-1.5">
            <img
              src={ndLogo}
              alt="Navdhan by Kubar Labs"
              className="h-10 w-auto object-contain"
            />
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {NAV_HREFS.map((href, i) => (
            <a
              key={href}
              href={href}
              className="text-body-sm font-medium text-graphite transition-colors hover:text-ink"
            >
              {t.nav.links[i]}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Button asChild variant="ember" size="sm">
            <a href={APPLY_URL}>{t.nav.apply}</a>
          </Button>
        </div>
      </div>
    </header>
  );
}
