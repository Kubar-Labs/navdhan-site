"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { Locale } from "@/src/lib/i18n/config";
import { JourneyLedger } from "./JourneyLedger";
import { Arrow } from "./MarketingChrome";
import styles from "./navdhan-marketing.module.css";

const trustItems = [
  ["trust-secure.svg", "Secure consent", ["Secure", "consent"]],
  ["trust-steps.svg", "Transparent steps", ["Transparent", "steps"]],
  ["trust-terms.svg", "Lender-decided terms", ["Lender-decided", "terms"]],
] as const;

const whyFaqs = [
  {
    question: "Is NavDhan the lender?",
    answer:
      "NavDhan helps organise your application and connect it with lending partners. It does not lend directly. Eligibility, approval, pricing and repayment terms are decided by the lender.",
  },
  {
    question: "Does applying guarantee financing?",
    answer:
      "No. A lender assesses your application against its own criteria and may request more information. An offer, approval or disbursal is not guaranteed.",
  },
  {
    question: "Can I apply without a platform referral?",
    answer:
      "Yes. You can start directly through NavDhan. If a participating business platform referred you, follow its instructions and use any referral details it provides.",
  },
  {
    question: "Who can help with my application?",
    answer:
      "Email support@navdhan.app for application questions. Share identity and financial documents through the application, not in an ordinary email.",
  },
] as const;

const howFaqs = [
  {
    question: "What should I have ready?",
    answer:
      "Keep your financing requirement, contact details, Aadhaar, PAN, GSTIN if registered, latest ITR PDF and business bank information handy. Follow the requests and consents shown in the application.",
  },
  {
    question: "Do I need GST registration to start?",
    answer:
      "The application asks whether your business is GST registered. If not, select the option for a business that is not registered and follow the relevant path. Lender eligibility criteria still apply.",
  },
  {
    question: "How long does a lender decision take?",
    answer:
      "Timing depends on the lender, the completeness of your information and any further checks. NavDhan does not promise a fixed approval or disbursal timeline.",
  },
  {
    question: "Is submission the same as approval?",
    answer:
      "No. A successful submission and reference number confirm that the application was submitted. They are not a loan approval or an offer.",
  },
  {
    question: "What if no offer is available?",
    answer:
      "An offer is not guaranteed. Review any request or feedback the lender provides, and contact support@navdhan.app if you need help with your application.",
  },
] as const;

type Accent = "green" | "blue" | "orange";

interface ChecklistItem {
  title: string;
  body: string;
}

interface PaperPanelProps {
  accent: Accent;
  eyebrow: string;
  title: string;
  body: string;
  bullets: readonly string[];
}

interface WalkthroughStage extends PaperPanelProps {
  number: string;
}

const walkthroughStages: readonly WalkthroughStage[] = [
  {
    number: "01",
    accent: "green",
    eyebrow: "FINANCING NEED",
    title: "Tell us what you need.",
    body: "Start with your financing requirement. These details describe your request, not a loan offer.",
    bullets: [
      "Amount and preferred tenure",
      "Purpose of the financing",
      "Referral code, if you have one",
    ],
  },
  {
    number: "02",
    accent: "blue",
    eyebrow: "CONTACT DETAILS",
    title: "Introduce yourself.",
    body: "Share the contact details needed for your application and the location of your business.",
    bullets: ["Full name and mobile number", "Email address", "Business PIN code"],
  },
  {
    number: "03",
    accent: "orange",
    eyebrow: "AADHAAR VERIFICATION",
    title: "Complete the identity step.",
    body: "Enter your Aadhaar details and follow the verification prompts in the application.",
    bullets: [
      "Enter Aadhaar in the secure journey",
      "Read the verification consent",
      "Complete the checks shown to you",
    ],
  },
  {
    number: "04",
    accent: "green",
    eyebrow: "PAN VERIFICATION",
    title: "Add your PAN details.",
    body: "Provide the PAN requested for your application and review the verification consent.",
    bullets: [
      "Check the PAN before continuing",
      "Read the stated verification purpose",
      "Give the consent requested in this step",
    ],
  },
  {
    number: "05",
    accent: "blue",
    eyebrow: "GST STATUS",
    title: "Share your GST status.",
    body: "Tell us whether your business is GST registered, then follow the relevant path.",
    bullets: [
      "If registered, provide your GSTIN",
      "Review the GST consent shown",
      "If not registered, use that option",
    ],
  },
  {
    number: "06",
    accent: "orange",
    eyebrow: "ITR UPLOAD",
    title: "Provide your latest ITR.",
    body: "Upload your latest filed Income Tax Return through the application.",
    bullets: ["PDF format", "Maximum file size: 10 MB", "Confirm the document when prompted"],
  },
  {
    number: "07",
    accent: "green",
    eyebrow: "BANK STATEMENTS",
    title: "Share bank information.",
    body: "Use the statement-sharing flow shown in the application and review its consent.",
    bullets: [
      "Have business account details ready",
      "Read what information is requested",
      "Complete the supported sharing flow",
    ],
  },
  {
    number: "08",
    accent: "blue",
    eyebrow: "REVIEW & SUBMIT",
    title: "Check before you submit.",
    body: "Review the information you have entered and read the final consents before submitting.",
    bullets: [
      "Correct any details that need updating",
      "Review all final consent requests",
      "Submit when your application is ready",
    ],
  },
  {
    number: "09",
    accent: "orange",
    eyebrow: "SUBMISSION RESULT",
    title: "Keep your reference.",
    body: "Check the submission result and retain the application reference shown after success.",
    bullets: [
      "Success: save the reference shown",
      "If unsuccessful, follow the next prompt",
      "Submission is not loan approval",
    ],
  },
] as const;

export function WhyNavDhanPage({ locale }: { locale: Locale }) {
  return (
    <div className={`${styles.site} ${styles.informationPage}`}>
      <section className={`${styles.hero} ${styles.informationHero} ${styles.whyHero}`}>
        <div className={`${styles.heroCopy} ${styles.informationHeroCopy}`}>
          <Eyebrow>Why NavDhan</Eyebrow>
          <h1>
            One application.
            <br />A clearer path.
          </h1>
          <p>
            Begin in one guided place. Know what to share, why it is requested, and what to review
            before you decide.
          </p>
          <HeroActions
            locale={locale}
            secondaryHref={`/${locale}/how-it-works`}
            secondaryLabel="See How It Works"
          />
        </div>
        <ChecklistPanel
          eyebrow="What you can expect"
          items={[
            {
              title: "One guided starting point",
              body: "Bring your business details and funding need together.",
            },
            {
              title: "Purposeful data sharing",
              body: "Review information requests and applicable consent.",
            },
            {
              title: "Terms before a decision",
              body: "Read any lender offer before choosing to continue.",
            },
            {
              title: "Support when you need it",
              body: "Get help with the application by email.",
            },
          ]}
          note="Credit approval and final terms remain with the lender."
        />
      </section>

      <TrustStrip />

      <section className={`${styles.section} ${styles.contextSection}`}>
        <div className={styles.contextIntro}>
          <Eyebrow>Your business, in context</Eyebrow>
          <h2 className={styles.displayHeading}>
            More context.
            <br />A clearer picture.
          </h2>
          <p className={styles.informationLead}>
            Bring your business details, tax information and bank statements together to help a
            lender understand your needs in context.
          </p>
          <p className={styles.contextNote}>
            More context does not guarantee financing.
            <br />
            The lender makes its own assessment.
          </p>
        </div>
        <ChecklistPanel
          compact
          eyebrow="Your business in context"
          items={[
            {
              title: "Business identity",
              body: "Your details, PAN and GST status where applicable.",
            },
            {
              title: "Trading activity",
              body: "Tax and business information requested in the journey.",
            },
            {
              title: "Cash-flow information",
              body: "Bank statements that help explain money in and out.",
            },
            {
              title: "Financing purpose",
              body: "What you need and how the funds would be used.",
            },
          ]}
          note="The lender determines what information and checks it needs."
        />
      </section>

      <EditorialSection
        eyebrow="Finance through familiar platforms"
        title={
          <>
            <span className={styles.desktopOnly}>Start here. Or through your platform.</span>
            <span className={styles.mobileOnly}>Start here. Or via your platform.</span>
          </>
        }
        panels={[
          {
            accent: "green",
            eyebrow: "Direct access",
            title: "Start with NavDhan.",
            body: "Begin directly on the website when you are ready to share your business financing requirement.",
            bullets: [
              "Start at navdhan.app",
              "Share your business requirement",
              "Review consent as you progress",
            ],
          },
          {
            accent: "blue",
            eyebrow: "Platform referral",
            title: "Through your business platform.",
            body: "If a participating platform refers you, follow its instructions and use the referral details it provides.",
            bullets: [
              "Keep any referral link or code handy",
              "Follow the applicable application checks",
              "Loan decisions stay with the lender",
            ],
          },
        ]}
      />

      <InformationFaq
        eyebrow="Good to know"
        title={
          <>
            Clarity, before
            <br />
            you begin.
          </>
        }
        faqs={whyFaqs}
        idPrefix="why-navdhan"
      />
      <InformationClosing locale={locale} />
    </div>
  );
}

export function HowItWorksPage({ locale }: { locale: Locale }) {
  return (
    <div className={`${styles.site} ${styles.informationPage}`}>
      <section className={`${styles.hero} ${styles.informationHero}`}>
        <div className={`${styles.heroCopy} ${styles.informationHeroCopy}`}>
          <Eyebrow>How It Works</Eyebrow>
          <h1>
            Your next step.
            <br />
            Made clearer.
          </h1>
          <p>
            Know what to prepare, what happens next, and who makes each decision along the
            application journey.
          </p>
          <HeroActions
            locale={locale}
            secondaryHref="#application-stages"
            secondaryLabel="See every step"
          />
        </div>
        <JourneyLedger audience="borrower" />
      </section>

      <TrustStrip />
      <HowItWorksWalkthrough />

      <EditorialSection
        eyebrow="After you submit"
        title="Lender review. Then your decision."
        panels={[
          {
            accent: "green",
            eyebrow: "03 / Review available options",
            title: "See what a lender offers.",
            body: "After review, a lender may request more information or make an offer. An offer is not guaranteed.",
            bullets: [
              "Check amount, rate and all charges",
              "Review tenure and repayment schedule",
              "Read conditions before you accept",
            ],
          },
          {
            accent: "blue",
            eyebrow: "04 / Continue with a lender",
            title: "Take the next step, informed.",
            body: "If you choose an available offer, complete the lender’s remaining requirements before any disbursal.",
            bullets: [
              "Review and retain the final documents",
              "Meet the lender’s disbursal conditions",
              "Repay and get service under its terms",
            ],
          },
        ]}
      />

      <InformationFaq
        eyebrow="Good to know"
        title={
          <>
            A little more
            <br />
            clarity.
          </>
        }
        faqs={howFaqs}
        idPrefix="how-it-works"
      />
      <InformationClosing locale={locale} />
    </div>
  );
}

function HeroActions({
  locale,
  secondaryHref,
  secondaryLabel,
}: {
  locale: Locale;
  secondaryHref: string;
  secondaryLabel: string;
}) {
  return (
    <div className={styles.heroActions}>
      <Link
        className={`${styles.button} ${styles.primary}`}
        href={`/${locale}/apply`}
        prefetch={false}
      >
        Start Application <Arrow light />
      </Link>
      <Link className={`${styles.button} ${styles.secondary}`} href={secondaryHref}>
        {secondaryLabel} <Arrow />
      </Link>
    </div>
  );
}

function TrustStrip() {
  return (
    <div className={styles.trustStrip} aria-label="Application principles">
      {trustItems.map(([asset, label, mobileLines]) => (
        <div key={label}>
          <Image src={`/assets/navdhan-redesign/${asset}`} alt="" width={48} height={48} />
          <span className={styles.desktopOnly}>{label}</span>
          <span className={styles.mobileOnly}>
            {mobileLines[0]}
            <br />
            {mobileLines[1]}
          </span>
        </div>
      ))}
    </div>
  );
}

function ChecklistPanel({
  eyebrow,
  items,
  note,
  compact = false,
}: {
  eyebrow: string;
  items: readonly ChecklistItem[];
  note: string;
  compact?: boolean;
}) {
  return (
    <aside className={`${styles.informationChecklist} ${compact ? styles.compactChecklist : ""}`}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <div className={styles.informationChecklistItems}>
        {items.map((item) => (
          <div className={styles.informationChecklistItem} key={item.title}>
            <span aria-hidden>✓</span>
            <p>
              <strong>{item.title}</strong>
              <small>{item.body}</small>
            </p>
          </div>
        ))}
      </div>
      <small className={styles.informationChecklistNote}>{note}</small>
    </aside>
  );
}

function EditorialSection({
  eyebrow,
  title,
  panels,
}: {
  eyebrow: string;
  title: ReactNode;
  panels: readonly PaperPanelProps[];
}) {
  return (
    <section className={`${styles.section} ${styles.informationEditorialSection}`}>
      <div className={styles.informationSectionHeading}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2>{title}</h2>
      </div>
      <div className={styles.informationEditorialGrid}>
        {panels.map((panel) => (
          <PaperPanel key={panel.eyebrow} {...panel} />
        ))}
      </div>
    </section>
  );
}

function PaperPanel({ accent, eyebrow, title, body, bullets }: PaperPanelProps) {
  return (
    <article className={`${styles.informationPaperPanel} ${styles[accent]}`}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h3>{title}</h3>
      <p>{body}</p>
      <ul>
        {bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
    </article>
  );
}

export function HowItWorksWalkthrough() {
  const sectionRef = useWalkthroughReveal();

  return (
    <section
      ref={sectionRef}
      className={`${styles.section} ${styles.walkthrough}`}
      id="application-stages"
      data-testid="walkthrough"
    >
      <div className={styles.informationSectionHeading}>
        <Eyebrow>Inside the application</Eyebrow>
        <h2>Every stage, explained.</h2>
        <p>
          From your financing request to submission. These are the stages in the current
          application; lender review follows.
        </p>
      </div>
      <div className={styles.walkthroughGrid}>
        {[0, 1, 2].map((rowIndex) => (
          <div
            className={styles.walkthroughRow}
            data-reveal-row
            data-testid={`walkthrough-row-${rowIndex + 1}`}
            key={rowIndex}
          >
            {walkthroughStages.slice(rowIndex * 3, rowIndex * 3 + 3).map((stage, columnIndex) => (
              <article
                className={`${styles.walkthroughCard} ${styles[stage.accent]}`}
                data-reveal-card
                data-testid={`walkthrough-card-${stage.number}`}
                key={stage.number}
                style={{ "--reveal-delay": `${columnIndex * 80}ms` } as CSSProperties}
              >
                <Eyebrow>
                  {stage.number} / {stage.eyebrow}
                </Eyebrow>
                <h3>{stage.title}</h3>
                <p>{stage.body}</p>
                <ul>
                  {stage.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function useWalkthroughReveal() {
  const sectionRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reducedMotion || typeof window.IntersectionObserver === "undefined") return;

    const mobile = window.matchMedia?.("(max-width: 900px)").matches ?? window.innerWidth <= 900;
    const cards = Array.from(section.querySelectorAll<HTMLElement>("[data-reveal-card]"));
    const rows = Array.from(section.querySelectorAll<HTMLElement>("[data-reveal-row]"));
    const revealCard = (card: HTMLElement) => card.setAttribute("data-revealed", "true");
    const revealRow = (row: HTMLElement) =>
      row.querySelectorAll<HTMLElement>("[data-reveal-card]").forEach(revealCard);

    let observer: IntersectionObserver;
    try {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const target = entry.target as HTMLElement;
            if (mobile) revealCard(target);
            else revealRow(target);
            observer.unobserve(target);
          });
        },
        { rootMargin: "0px 0px -15% 0px", threshold: 0 },
      );
    } catch {
      return;
    }

    const triggerLine = window.innerHeight * 0.85;
    if (mobile) {
      cards.forEach((card) => {
        if (card.getBoundingClientRect().top <= triggerLine) revealCard(card);
      });
    } else {
      rows.forEach((row) => {
        if (row.getBoundingClientRect().top <= triggerLine) revealRow(row);
      });
    }

    section.setAttribute("data-reveal-mode", mobile ? "mobile" : "desktop");
    const targets = mobile ? cards : rows;
    targets.forEach((target) => {
      const allRevealed = mobile
        ? target.hasAttribute("data-revealed")
        : Array.from(target.querySelectorAll<HTMLElement>("[data-reveal-card]")).every((card) =>
            card.hasAttribute("data-revealed"),
          );
      if (!allRevealed) observer.observe(target);
    });

    return () => observer.disconnect();
  }, []);

  return sectionRef;
}

export function InformationFaq({
  eyebrow,
  title,
  faqs,
  idPrefix,
}: {
  eyebrow: string;
  title: ReactNode;
  faqs: readonly { question: string; answer: string }[];
  idPrefix: string;
}) {
  const [open, setOpen] = useState(0);
  const reactId = useId().replace(/:/g, "");

  return (
    <section className={`${styles.section} ${styles.informationFaqSection}`}>
      <div className={styles.informationFaqIntro}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className={styles.displayHeading}>{title}</h2>
        <p>A few things to know before you begin.</p>
      </div>
      <div className={styles.faqList}>
        {faqs.map(({ question, answer }, index) => {
          const expanded = index === open;
          const questionId = `${idPrefix}-${reactId}-question-${index}`;
          const answerId = `${idPrefix}-${reactId}-answer-${index}`;
          return (
            <div className={styles.faq} key={question}>
              <button
                type="button"
                id={questionId}
                aria-expanded={expanded}
                aria-controls={answerId}
                onClick={() => setOpen(expanded ? -1 : index)}
              >
                <span>{question}</span>
                <Image
                  src={`/assets/navdhan-redesign/faq-${expanded ? "minus" : "plus"}.svg`}
                  alt=""
                  width={22}
                  height={22}
                />
              </button>
              {expanded ? (
                <p id={answerId} role="region" aria-labelledby={questionId}>
                  {answer}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      <a className={styles.informationFaqSupport} href="mailto:support@navdhan.app">
        Still need a hand?
        <br />
        support@navdhan.app
      </a>
    </section>
  );
}

function InformationClosing({ locale }: { locale: Locale }) {
  return (
    <section className={styles.closing}>
      <div>
        <h2>
          Ready for your
          <br />
          next business move?
        </h2>
        <p>Start with one application. Take it one clear step at a time.</p>
      </div>
      <div>
        <Link
          className={`${styles.button} ${styles.primary}`}
          href={`/${locale}/apply`}
          prefetch={false}
        >
          Start Application <Arrow light />
        </Link>
        <a className={styles.textLink} href="mailto:support@navdhan.app">
          Talk to Us&nbsp; →
        </a>
      </div>
    </section>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className={styles.eyebrow}>{children}</p>;
}
