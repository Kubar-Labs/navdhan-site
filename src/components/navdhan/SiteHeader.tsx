import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { label: "Loan Products", href: "#products" },
  { label: "Why Navdhan", href: "#why" },
  { label: "EMI Calculator", href: "#emi" },
  { label: "Stories", href: "#stories" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-ink text-ink-foreground">
      <div className="container-prose flex h-16 items-center justify-between">
        <Link to="/" className="flex items-baseline gap-2">
          <span className="font-display text-2xl tracking-tight">Navdhan</span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-ink-foreground/60">
            by Kubar Labs
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-ink-foreground/75 transition-colors hover:text-gold"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <Button variant="gold" size="sm">
          Apply Loan
        </Button>
      </div>
    </header>
  );
}
