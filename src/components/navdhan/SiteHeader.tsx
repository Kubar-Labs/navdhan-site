import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import ndLogo from "@/assets/nd-logo.png";

const NAV_LINKS = [
  { label: "Loan Products", href: "#products" },
  { label: "Why Navdhan", href: "#why" },
  { label: "EMI Calculator", href: "#emi" },
  { label: "Stories", href: "#stories" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-gray-500 backdrop-blur-md text-foreground shadow-sm">
      <div className="container-prose flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <img
            src={ndLogo}
            alt="Navdhan by Kubar Labs"
            className="h-24 w-auto object-contain transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-amber-50 transition-colors hover:text-brand-blue"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <Button variant="orange" size="sm">
          Apply Loan
        </Button>
      </div>
    </header>
  );
}
