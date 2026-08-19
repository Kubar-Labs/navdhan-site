/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { emiDefaults } from "@/src/lib/data/siteData";
import { EmiCalculator } from "./EmiCalculator";

describe("EmiCalculator", () => {
  afterEach(() => cleanup());

  it("caps the principal at ₹1 crore and keeps the apply link in the current locale", () => {
    render(
      <EmiCalculator
        locale="hi"
        eyebrow="EMI"
        heading="Calculator"
        intro="Estimate repayments"
        amountLabel="Amount"
        rateLabel="Rate"
        tenureLabel="Tenure"
        monthlyLabel="Monthly"
        principalLabel="Principal"
        totalInterestLabel="Interest"
        totalPayableLabel="Total"
        cta="Apply"
        defaults={emiDefaults}
      />,
    );

    expect(screen.getByRole("slider", { name: "Amount" })).toHaveAttribute("max", "10000000");
    expect(screen.getByRole("link", { name: "Apply" })).toHaveAttribute("href", "/hi/apply");
  });
});
