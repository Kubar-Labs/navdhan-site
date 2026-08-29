"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { JourneyLedger, type JourneyAudience } from "./JourneyLedger";
import { Arrow } from "./MarketingChrome";
import { RedesignedEmiCalculator } from "./RedesignedEmiCalculator";
import styles from "./navdhan-marketing.module.css";

const trustItems = [
  ["trust-secure.svg", "Secure consent"],
  ["trust-steps.svg", "Transparent steps"],
  ["trust-terms.svg", "Lender-decided terms"],
];

export interface BorrowerHeroCopy {
  eyebrow: string;
  title: string;
  body: string;
  primary: string;
  secondary: string;
}
export function HomeMarketingPage({ locale, heroCopy }: { locale: string; heroCopy?: BorrowerHeroCopy }) {
  return (
    <div className={styles.site}>
      <Hero locale={locale} audience="borrower" borrowerCopy={heroCopy} />
      <TrustStrip />
      <section className={`${styles.section} ${styles.financeSection}`} id="products">
        <h2 className={styles.centerHeading}>What could you finance?</h2>
        <div className={styles.financeGrid}>
          <FinanceCard accent="green" title="Working Capital" body={<>Bridge gaps and keep<br />your business moving.</>} art="working" />
          <FinanceCard accent="blue" title="Invoices & Orders" body={<>Unlock cash tied up in<br />invoices and confirmed orders.</>} art="invoice" />
          <FinanceCard accent="orange" title="Equipment & Expansion" body={<>Invest in equipment and<br />grow with confidence.</>} art="equipment" />
        </div>
      </section>

      <section className={`${styles.section} ${styles.preparation}`} id="why">
        <div className={styles.prepIntro}>
          <h2 className={styles.displayHeading}>Prepared for<br />the next step.</h2>
          <p className={styles.lead}>A straightforward application starts with the right information. Keep these details handy and share them through the guided journey.</p>
          <p className={styles.referral}>Referred by a business platform?<br />You can use the same NavDhan application.</p>
        </div>
        <div className={styles.prepCard}>
          <Eyebrow>Your application file</Eyebrow>
          <Checklist title="Business details">Contact name, business PAN, GSTIN and funding requirement.</Checklist>
          <Checklist title="PAN and Aadhaar">Identity checks for the application steps.</Checklist>
          <Checklist title="GST, if registered">GST details, if your business is registered.</Checklist>
          <Checklist title="ITR and bank information">Keep your latest ITR and bank statement information handy.</Checklist>
          <small>*The application will guide you through the checks relevant to you.</small>
        </div>
      </section>

      <section className={`${styles.section} ${styles.emiSection}`} id="emi">
        <h2 className={styles.sectionHeading}>Plan around your cash flow.</h2>
        <p className={styles.muted}>Adjust the amount, rate and tenure to estimate your monthly EMI.</p>
        <RedesignedEmiCalculator locale={locale} />
        <p className={styles.disclaimer}>This is an illustration, not a loan offer. Actual rates, fees, approval and repayment terms are decided by the lender.</p>
      </section>

      <FaqSection />
      <Closing locale={locale} audience="borrower" />
    </div>
  );
}

export function PartnerMarketingPage({ locale, audience }: { locale: string; audience: "platform" | "lender" }) {
  const platform = audience === "platform";
  return (
    <div className={styles.site}>
      <Hero locale={locale} audience={audience} />
      <TrustStrip />
      <section className={`${styles.section} ${styles.responsibilitySection} ${platform ? styles.platformResponsibilities : styles.lenderResponsibilities}`} id="responsibilities">
        <h2 className={styles.sectionHeading}>
          <span className={styles.desktopOnly}>{platform ? "A useful starting point. Room to grow." : "Origination support. Lender-owned decisions."}</span>
          <span className={styles.mobileOnly}>{platform ? "Start here. Grow from here." : "Origination support. Lender decisions."}</span>
        </h2>
        <div className={`${styles.editorialGrid} ${platform ? styles.twoColumns : styles.threeColumns}`}>
          {platform ? (
            <>
              <EditorialCard accent="green" eyebrow="01 / Hosted journey" title="Send customers directly." body="Use NavDhan as your customer’s application destination, including when your platform does not have a payment provider." bullets={["Same guided borrower application", "Optional referral code in the existing flow", "Lender-led review and terms"]} />
              <EditorialCard accent="blue" eyebrow="02 / Integration discussion" title="Build the next step together." body="For a more integrated experience, discuss your customer journey, data requirements and the right implementation scope." bullets={["Agree the experience and scope", "Confirm consent and data responsibilities", "Plan the rollout with your team"]} />
            </>
          ) : (
            <>
              <EditorialCard accent="green" eyebrow="01 / NavDhan" title="Origination support." body="The borrower-facing journey supports the collection of business details, documents and consent for origination." bullets={["Application details", "Documents and consent", "A clearer handoff for review"]} />
              <EditorialCard accent="blue" eyebrow="02 / Your lending team" title="Credit decisions." body="Your team defines the lending requirements and retains control of underwriting, approval and terms." bullets={["Eligibility and underwriting", "Pricing and repayment terms", "Credit decision and approval"]} />
              <EditorialCard accent="orange" eyebrow="03 / Business owner" title="Informed participation." body="The business owner provides information, completes the guided steps and reviews the lender’s terms." bullets={["Accurate business information", "Relevant documents", "Review of lender terms"]} />
            </>
          )}
        </div>
        {!platform ? <p className={styles.disclaimer}>Integration details are agreed with each lending partner. Underwriting and credit decisions remain with the lender.</p> : null}
      </section>
      <Closing locale={locale} audience={audience} />
    </div>
  );
}

function Hero({ locale, audience, borrowerCopy }: { locale: string; audience: JourneyAudience; borrowerCopy?: BorrowerHeroCopy }) {
  const borrower = borrowerCopy
    ? {
        eyebrow: borrowerCopy.eyebrow,
        title: borrowerCopy.title,
        body: borrowerCopy.body,
        primary: borrowerCopy.primary,
        secondary: borrowerCopy.secondary,
        primaryHref: `/${locale}/apply`,
        secondaryHref: `/${locale}/how-it-works`,
      }
    : {
        eyebrow: "Business financing, made simple",
        title: <>Business financing,<br />without the runaround.</>,
        body: "Apply once, share your details securely, and continue to financing options from our lending partners.",
        primary: "Start Application",
        secondary: "See How It Works",
        primaryHref: `/${locale}/apply`,
        secondaryHref: `/${locale}/how-it-works`,
      };
  const content = {
    borrower,
    platform: {
      eyebrow: "For platforms",
      title: <>Help your customers<br />take their next step.</>,
      body: "Give your business customers a clear path to financing. Start with the hosted NavDhan journey and discuss deeper integration when you’re ready.",
      primary: "Discuss Integration",
      secondary: "Start Application",
      primaryHref: "mailto:partnerships@navdhan.app",
      secondaryHref: `/${locale}/apply`,
    },
    lender: {
      eyebrow: "For lenders",
      title: <>Clearer applications.<br />Your credit decisions.</>,
      body: "Bring structure to origination while keeping eligibility, underwriting and lending terms with your team.",
      primary: "Partner with NavDhan",
      secondary: "See Responsibilities",
      primaryHref: "mailto:partnerships@navdhan.app",
      secondaryHref: "#responsibilities",
    },
  }[audience];

  return (
    <section className={`${styles.hero} ${audience === "borrower" ? styles.homeHero : styles.partnerHero}`} id="how-it-works">
      <div className={styles.heroCopy}>
        <h1>{content.title}</h1>
        <p>{content.body}</p>
        <div className={styles.heroActions}>
          <Link className={`${styles.button} ${styles.primary}`} href={content.primaryHref} prefetch={content.primaryHref.includes("/apply") ? false : undefined}>{content.primary} <Arrow light /></Link>
          <Link className={`${styles.button} ${styles.secondary}`} href={content.secondaryHref} prefetch={content.secondaryHref.includes("/apply") ? false : undefined}>{content.secondary} <Arrow /></Link>
        </div>
      </div>
      <JourneyLedger audience={audience} />
    </section>
  );
}

function TrustStrip() {
  return (
    <div className={styles.trustStrip}>
      {trustItems.map(([asset, label]) => (
        <div key={label}>
          <Image src={`/assets/navdhan-redesign/${asset}`} alt="" width={48} height={48} />
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

function FinanceCard({ accent, title, body, art }: { accent: "green" | "blue" | "orange"; title: string; body: React.ReactNode; art: "working" | "invoice" | "equipment" }) {
  return (
    <article className={`${styles.paperCard} ${styles[accent]}`}>
      <h3>{title}</h3>
      <p>{body}</p>
      {art === "invoice" ? <InvoiceArtwork /> : (
        <Image className={styles.financeArt} src={`/assets/navdhan-redesign/${art === "working" ? "working-capital.svg" : "equipment.svg"}`} alt="" width={186} height={140} />
      )}
    </article>
  );
}

function InvoiceArtwork() {
  return (
    <div className={styles.invoiceArt} aria-hidden>
      {[1, 2, 3, 4, 5, 6, 7].map((part) => (
        <span className={styles[`invoice${part}`]} key={part}>
          <Image src={`/assets/navdhan-redesign/invoice-${part}.svg`} alt="" fill sizes="186px" />
        </span>
      ))}
      <span className={styles.invoiceLabel}>INVOICE</span>
    </div>
  );
}

function Checklist({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className={styles.checklist}><span>✓</span><p><strong>{title}</strong><small>{children}</small></p></div>;
}

const faqs = [
  ["Is NavDhan the lender?", "NavDhan connects businesses with lending partners. It does not lend directly. Eligibility, approval, pricing and repayment terms are decided by the lender."],
  ["Who can start an application?", "Business owners seeking financing can begin with their business details. Eligibility depends on that information and the lender’s criteria."],
  ["What documents should I have ready?", "Keep your PAN, Aadhaar, GST details if registered, latest ITR and bank information handy. The application guides you through the relevant checks."],
  ["How long does a decision take?", "Review times depend on the lender and the completeness of your application. Submitting an application does not guarantee approval."],
  ["Can I apply if a platform referred me?", "Yes. Partner-referred business owners can use the same NavDhan application. Enter a referral code if your platform has provided one."],
  ["Where can I review rates and charges?", "Review the lender’s interest rate, repayment schedule and applicable fees before you continue. The calculator on this page is an illustration, not an offer."],
];

function FaqSection() {
  const [open, setOpen] = useState(0);
  return (
    <section className={`${styles.section} ${styles.faqSection}`}>
      <div className={styles.faqIntro}>
        <h2 className={styles.displayHeading}>Answers, without<br />the jargon.</h2>
        <p>A few things to know before you begin.</p>
        <a href="mailto:support@navdhan.app">Still need a hand?<br />support@navdhan.app</a>
      </div>
      <div className={styles.faqList}>
        {faqs.map(([question, answer], index) => {
          const expanded = index === open;
          return (
            <div className={styles.faq} key={question}>
              <button
                type="button"
                id={`faq-question-${index}`}
                aria-expanded={expanded}
                aria-controls={`faq-answer-${index}`}
                onClick={() => setOpen(expanded ? -1 : index)}
              >
                <span>{question}</span>
                <Image src={`/assets/navdhan-redesign/faq-${expanded ? "minus" : "plus"}.svg`} alt="" width={22} height={22} />
              </button>
              {expanded ? <p id={`faq-answer-${index}`} role="region" aria-labelledby={`faq-question-${index}`}>{answer}</p> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function EditorialCard({ accent, eyebrow, title, body, bullets }: { accent: "green" | "blue" | "orange"; eyebrow: string; title: string; body: string; bullets: string[] }) {
  return (
    <article className={`${styles.editorialCard} ${styles[accent]}`}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h3>{title}</h3>
      <p>{body}</p>
      <ul>{bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
    </article>
  );
}

function Closing({ locale, audience }: { locale: string; audience: JourneyAudience }) {
  const content = audience === "borrower"
    ? { title: <>Ready for your<br />next business move?</>, body: "Start with one application. Take it one clear step at a time.", button: "Start Application", href: `/${locale}/apply`, link: "Talk to Us", linkHref: "mailto:hello@navdhan.app" }
    : audience === "platform"
      ? { title: <>Let’s map your<br />customer journey.</>, body: "Start with the hosted flow or discuss the next integration step.", button: "Discuss Integration", href: "mailto:partnerships@navdhan.app", link: "partnerships@navdhan.app", linkHref: "mailto:partnerships@navdhan.app" }
      : { title: <>Let’s discuss your<br />origination needs.</>, body: "Align the borrower journey, information requirements and handoff.", button: "Partner with NavDhan", href: "mailto:partnerships@navdhan.app", link: "partnerships@navdhan.app", linkHref: "mailto:partnerships@navdhan.app" };
  return (
    <section className={styles.closing}>
      <div><h2>{content.title}</h2><p>{content.body}</p></div>
      <div><Link className={`${styles.button} ${styles.primary}`} href={content.href} prefetch={content.href.includes("/apply") ? false : undefined}>{content.button} <Arrow light /></Link><Link className={styles.textLink} href={content.linkHref}>{content.link}</Link></div>
    </section>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className={styles.eyebrow}>{children}</p>;
}
