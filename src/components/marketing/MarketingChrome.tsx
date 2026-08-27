"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { isValidLocale, localeOptions, type Locale } from "@/src/lib/i18n/config";
import styles from "./navdhan-marketing.module.css";

export function MarketingHeader({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const links = [
    { label: "Loan Options", href: `/${locale}/#products` },
    { label: "How It Works", href: `/${locale}/#how-it-works` },
    { label: "Why NavDhan", href: `/${locale}/#why` },
    { label: "For Platforms", href: `/${locale}/platforms` },
    { label: "For Lenders", href: `/${locale}/lenders` },
  ];

  return (
    <header className={styles.header}>
      <Link className={styles.logoLink} href={`/${locale}`} aria-label="NavDhan home">
        <Image src="/assets/logos/NavDhan.png" alt="NavDhan" width={160} height={71} priority />
      </Link>
      <nav className={styles.desktopNav} aria-label="Main navigation">
        {links.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className={pathname === link.href ? styles.activeNav : undefined}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <Link className={`${styles.button} ${styles.headerCta}`} href={`/${locale}/apply`}>
        Start Application
      </Link>
      <button
        className={styles.menuButton}
        type="button"
        aria-expanded={open}
        aria-controls="mobile-navigation"
        aria-label={open ? "Close navigation" : "Open navigation"}
        onClick={() => setOpen((value) => !value)}
      >
        <span />
        <span />
        <span />
      </button>
      {open ? (
        <nav id="mobile-navigation" className={styles.mobileNav} aria-label="Mobile navigation">
          {links.map((link) => (
            <Link key={link.label} href={link.href} onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
          <Link className={`${styles.button} ${styles.primary}`} href={`/${locale}/apply`}>
            Start Application <Arrow light />
          </Link>
        </nav>
      ) : null}
    </header>
  );
}

export function MarketingFooter({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const switchLocale = (nextLocale: string) => {
    const [, currentLocale, ...rest] = pathname.split("/");
    const suffix = isValidLocale(currentLocale) && rest.length > 0 ? `/${rest.join("/")}` : "";
    window.location.assign(`/${nextLocale}${suffix}${window.location.search}${window.location.hash}`);
  };

  const explore = [
    ["Loan Options", `/${locale}/#products`],
    ["How It Works", `/${locale}/#how-it-works`],
    ["Why NavDhan", `/${locale}/#why`],
    ["For Platforms", `/${locale}/platforms`],
    ["For Lenders", `/${locale}/lenders`],
    ["Team", `/${locale}/team`],
  ];
  const contact = [
    ["Loan Enquiry", "mailto:loans@navdhan.app"],
    ["Partnership Enquiry", "mailto:partnerships@navdhan.app"],
    ["Talk to Us", "mailto:hello@navdhan.app"],
    ["Support", "mailto:support@navdhan.app"],
    ["Careers", "mailto:careers@navdhan.app"],
    ["Press", "mailto:press@navdhan.app"],
  ];
  const legal = [
    ["Privacy Policy", "privacy-policy"],
    ["Terms of Use", "terms-of-use"],
    ["Cookie Policy", "cookie-policy"],
    ["Consent Policy", "consent-policy"],
    ["Fair Practices Code", "fair-practices-code"],
    ["Grievance Redressal", "grievance-redressal"],
    ["RBI-DLG Disclosure", "rbi-dlg-disclosure"],
  ];

  return (
    <footer className={styles.footer}>
      <div className={styles.footerGrid}>
        <div className={styles.footerBrand}>
          <Image src="/assets/logos/NavDhan.png" alt="NavDhan" width={160} height={71} />
          <p>Business financing,<br />made simple.</p>
        </div>
        <FooterColumn title="Explore" links={explore} />
        <FooterColumn title="Contact" links={contact} />
        <div className={styles.footerLegal}>
          <p className={styles.footerTitle}>Legal &amp; Policies</p>
          <div>
            {legal.map(([label, slug]) => (
              <Link key={slug} href={`/${locale}/legal/${slug}`}>{label}</Link>
            ))}
          </div>
        </div>
      </div>
      <div className={styles.footerRule} />
      <div className={styles.footerBottom}>
        <div>
          <p>Kubar Protocol Private Limited · CIN: U70200WB2024PTC274850</p>
        </div>
        <label>
          <span className={styles.srOnly}>Language</span>
          <select value={locale} onChange={(event) => switchLocale(event.target.value)}>
            {localeOptions.map((option) => (
              <option key={option.value} value={option.value}>Language: {option.label}</option>
            ))}
          </select>
        </label>
        <p>NavDhan does not lend directly. Credit decisions, rates and terms remain with the lending partner.</p>
        <p>© 2026 Kubar Protocol Private Limited.</p>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: string[][] }) {
  return (
    <div className={styles.footerColumn}>
      <p className={styles.footerTitle}>{title}</p>
      {links.map(([label, href]) => <Link key={label} href={href}>{label}</Link>)}
    </div>
  );
}

export function Arrow({ light = false }: { light?: boolean }) {
  return (
    <Image
      aria-hidden
      src={light ? "/assets/navdhan-redesign/arrow-light.svg" : "/assets/navdhan-redesign/arrow-dark.svg"}
      alt=""
      width={18}
      height={18}
    />
  );
}
