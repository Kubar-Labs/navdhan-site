"use client";

import { useState } from "react";
import Link from "next/link";
import { calculateEmiBreakdown, formatCurrencyInr } from "@/src/lib/utils/emi";
import type { EmiDefaults } from "@/src/types";

export interface EmiCalculatorProps {
  locale: string;
  eyebrow: string;
  heading: string;
  intro: string;
  amountLabel: string;
  rateLabel: string;
  tenureLabel: string;
  monthlyLabel: string;
  principalLabel: string;
  totalInterestLabel: string;
  totalPayableLabel: string;
  cta: string;
  defaults: EmiDefaults;
}

export function EmiCalculator({
  locale,
  eyebrow,
  heading,
  intro,
  amountLabel,
  rateLabel,
  tenureLabel,
  monthlyLabel,
  principalLabel,
  totalInterestLabel,
  totalPayableLabel,
  cta,
  defaults,
}: EmiCalculatorProps) {
  const [amount, setAmount] = useState(defaults.defaultAmount);
  const [rate, setRate] = useState(defaults.defaultRate);
  const [tenure, setTenure] = useState(defaults.defaultTenure);

  const breakdown = calculateEmiBreakdown(amount, rate, tenure);

  return (
    <>
      <p className="text-sm font-semibold uppercase tracking-wide text-nt-orange-600">{eyebrow}</p>
      <h2 className="font-display mt-4 text-3xl italic tracking-tight text-nt-slate-900 md:text-4xl">
        {heading}
      </h2>
      <p className="mt-4 max-w-2xl text-nt-slate-600">{intro}</p>

      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        <div className="space-y-8">
          <Slider
            label={amountLabel}
            value={amount}
            min={defaults.minAmount}
            max={defaults.maxAmount}
            step={100000}
            format={(v) => formatCurrencyInr(v)}
            onChange={setAmount}
          />
          <Slider
            label={rateLabel}
            value={rate}
            min={defaults.minRate}
            max={defaults.maxRate}
            step={0.5}
            format={(v) => `${v}% p.a.`}
            onChange={setRate}
          />
          <Slider
            label={tenureLabel}
            value={tenure}
            min={defaults.minTenure}
            max={defaults.maxTenure}
            step={1}
            format={(v) => `${v} months`}
            onChange={setTenure}
          />
        </div>

        <div className="rounded-2xl border border-nt-slate-200 bg-nt-cream p-8">
          <div className="grid grid-cols-2 gap-6">
            <Metric label={monthlyLabel} value={formatCurrencyInr(breakdown.emi)} large />
            <Metric label={totalPayableLabel} value={formatCurrencyInr(breakdown.totalPayable)} />
            <Metric label={principalLabel} value={formatCurrencyInr(breakdown.principal)} />
            <Metric label={totalInterestLabel} value={formatCurrencyInr(breakdown.totalInterest)} />
          </div>
          <Link
            href={`/${locale}/apply`}
            className="mt-8 inline-flex w-full items-center justify-center rounded-md bg-nt-orange-600 px-6 py-3 text-sm font-semibold text-white hover:bg-nt-orange-700"
          >
            {cta}
          </Link>
        </div>
      </div>
    </>
  );
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}

function Slider({ label, value, min, max, step, format, onChange }: SliderProps) {
  return (
    <div>
      <label className="flex justify-between text-sm font-medium text-nt-slate-700">
        <span>{label}</span>
        <span>{format(value)}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3"
      />
    </div>
  );
}

interface MetricProps {
  label: string;
  value: string;
  large?: boolean;
}

function Metric({ label, value, large = false }: MetricProps) {
  return (
    <div>
      <p className="text-sm text-nt-slate-600">{label}</p>
      <p
        className={`mt-1 font-bold text-nt-slate-900 ${large ? "text-3xl" : "text-xl font-semibold"}`}
      >
        {value}
      </p>
    </div>
  );
}
