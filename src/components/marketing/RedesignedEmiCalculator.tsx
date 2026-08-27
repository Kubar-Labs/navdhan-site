"use client";

import Link from "next/link";
import { useState } from "react";
import { calculateEmiBreakdown, formatCurrencyInr } from "@/src/lib/utils/emi";
import { emiDefaults } from "@/src/lib/data/siteData";
import { Arrow } from "./MarketingChrome";
import styles from "./navdhan-marketing.module.css";

export function RedesignedEmiCalculator({ locale }: { locale: string }) {
  const [amount, setAmount] = useState(emiDefaults.defaultAmount);
  const [rate, setRate] = useState(emiDefaults.defaultRate);
  const [tenure, setTenure] = useState(emiDefaults.defaultTenure);
  const result = calculateEmiBreakdown(amount, rate, tenure);

  return (
    <div className={styles.calculator}>
      <div className={styles.sliders}>
        <Slider label="Loan Amount" value={amount} min={emiDefaults.minAmount} max={emiDefaults.maxAmount} step={100000} display={formatCurrencyInr(amount)} onChange={setAmount} />
        <Slider label="Interest Rate" value={rate} min={emiDefaults.minRate} max={emiDefaults.maxRate} step={0.5} display={`${rate}% p.a.`} onChange={setRate} />
        <Slider label="Tenure" value={tenure} min={emiDefaults.minTenure} max={emiDefaults.maxTenure} step={1} display={`${tenure} months`} onChange={setTenure} />
      </div>
      <div className={styles.estimate}>
        <small>ESTIMATED MONTHLY EMI</small>
        <p className={styles.emiValue}>{formatCurrencyInr(result.emi)}</p>
        <div className={styles.metricRow}>
          <Metric label="Principal" value={formatCurrencyInr(result.principal)} />
          <Metric label="Total Interest" value={formatCurrencyInr(result.totalInterest)} />
          <Metric label="Total Repayment" value={formatCurrencyInr(result.totalPayable)} />
        </div>
        <Link className={`${styles.button} ${styles.primary} ${styles.calculatorCta}`} href={`/${locale}/apply`}>
          Start Application <Arrow light />
        </Link>
        <p className={styles.estimateNote}>Illustrative estimate. Lender terms may differ.</p>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step, display, onChange }: { label: string; value: number; min: number; max: number; step: number; display: string; onChange: (value: number) => void }) {
  const progress = ((value - min) / (max - min)) * 100;
  return (
    <label className={styles.slider}>
      <span><span>{label}</span><strong>{display}</strong></span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        style={{ "--range-progress": `${progress}%` } as React.CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><small>{label}</small><strong>{value}</strong></div>;
}
