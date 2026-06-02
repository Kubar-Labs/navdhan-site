const COLUMNS = [
  {
    title: "Contact Us",
    items: [
      { label: "Loan Enquiry", href: "mailto:loans@navdhan.in" },
      { label: "Partnership Enquiry", href: "mailto:partners@navdhan.in" },
    ],
  },
  {
    title: "Company",
    items: [
      { label: "About Navdhan", href: "#" },
      { label: "Loan Products", href: "#products" },
      { label: "EMI Calculator", href: "#emi" },
    ],
  },
  {
    title: "Legal",
    items: [
      { label: "Terms of Service", href: "#" },
      { label: "Privacy Policy", href: "#" },
      { label: "Fair Practices Code", href: "#" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-brand-navy text-white/90">
      <div className="container-prose grid gap-12 py-16 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <p className="font-display text-3xl text-white">Navdhan</p>
          <p className="mt-2 max-w-xs text-sm text-white/70">
            A loan marketplace for India's MSMEs, built by Kubar Labs.
          </p>
          <div className="mt-8 space-y-1 text-sm text-white/70">
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/50 font-medium">
              Kubar Labs Pvt. Ltd.
            </p>
            <p>Registered Office, Bengaluru, India</p>
            <a
              href="https://kubarlabs.com"
              className="inline-block pt-2 text-brand-orange hover:text-brand-orange/80 hover:underline transition-colors"
            >
              kubarlabs.com →
            </a>
          </div>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/50 font-medium">
              {col.title}
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {col.items.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    className="text-white/80 transition-colors hover:text-brand-orange"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10">
        <div className="container-prose flex flex-col items-start justify-between gap-2 py-6 text-xs text-white/60 md:flex-row md:items-center">
          <p>© {new Date().getFullYear()} Kubar Labs. All rights reserved.</p>
          <p>RBI Aligned · FACE Registered · 20+ Lender Partners</p>
        </div>
      </div>
    </footer>
  );
}
