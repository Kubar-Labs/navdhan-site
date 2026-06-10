/**
 * Calculate the monthly EMI (equated monthly installment) for a loan.
 *
 * @param principal     Loan amount.
 * @param annualRatePct Annual interest rate as a percentage (e.g. 14 for 14% p.a.).
 * @param months        Tenure in months.
 */
export function calcEmi(principal: number, annualRatePct: number, months: number) {
  const r = annualRatePct / 12 / 100;
  if (r === 0) return principal / months;
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}
