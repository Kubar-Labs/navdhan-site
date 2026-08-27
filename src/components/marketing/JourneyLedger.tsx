import Image from "next/image";
import styles from "./navdhan-marketing.module.css";

export type JourneyAudience = "borrower" | "platform" | "lender";

const journeys = {
  borrower: {
    steps: ["Tell us about your business", "Share documents securely", "Review available options", "Continue with a lender"],
    note: "Terms and approval are decided by the lender.",
  },
  platform: {
    steps: ["Refer your customers", "Use the hosted journey", "Share consented details", "Continue to a lender"],
    note: "Lender criteria, terms and approval apply.",
  },
  lender: {
    steps: ["Set eligibility criteria", "Receive consented details", "Review applications", "Decide terms & approval"],
    note: "Underwriting and credit decisions remain yours.",
  },
};

const assets = [
  ["step-business.svg", "rail-orange.svg"],
  ["step-secure.svg", "rail-green.svg"],
  ["step-review.svg", "rail-blue.svg"],
  ["step-lender.svg", "rail-navy.svg"],
];

export function JourneyLedger({ audience }: { audience: JourneyAudience }) {
  const journey = journeys[audience];
  return (
    <div className={styles.ledger}>
      <Image className={styles.ledgerPaper} src="/assets/navdhan-redesign/ledger-paper.svg" alt="" fill priority sizes="(max-width: 700px) 100vw, 736px" />
      <div className={styles.ledgerRows}>
        {journey.steps.map((label, index) => (
          <div className={styles.ledgerRow} key={label}>
            <span className={styles[`step${index + 1}`]}>0{index + 1}</span>
            <Image className={styles.stepIcon} src={`/assets/navdhan-redesign/${assets[index][0]}`} alt="" width={64} height={64} />
            <div className={styles.stepLabel}>
              <Image src={`/assets/navdhan-redesign/${assets[index][1]}`} alt="" width={458} height={12} />
              <p>{label}</p>
            </div>
          </div>
        ))}
        <div className={styles.ledgerNote}>
          <Image src="/assets/navdhan-redesign/disclosure.svg" alt="" width={14} height={14} />
          <span>{journey.note}</span>
        </div>
      </div>
    </div>
  );
}
