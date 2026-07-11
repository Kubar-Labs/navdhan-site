export interface EmiBreakdown {
  emi: number;
  principal: number;
  totalInterest: number;
  totalPayable: number;
}

export function calculateEmiBreakdown(
  principal: number,
  annualRatePercent: number,
  tenureMonths: number,
): EmiBreakdown {
  const principalPaise = Math.round(principal * 100);
  const monthlyRate = annualRatePercent / 12 / 100;

  let emiPaise = 0;
  if (monthlyRate === 0 || tenureMonths === 0) {
    emiPaise = tenureMonths > 0 ? Math.round(principalPaise / tenureMonths) : principalPaise;
  } else {
    const factor = Math.pow(1 + monthlyRate, tenureMonths);
    emiPaise = Math.round((principalPaise * monthlyRate * factor) / (factor - 1));
  }

  const totalPayablePaise = emiPaise * tenureMonths;
  const totalInterestPaise = totalPayablePaise - principalPaise;

  return {
    emi: emiPaise / 100,
    principal: principalPaise / 100,
    totalInterest: totalInterestPaise / 100,
    totalPayable: totalPayablePaise / 100,
  };
}

export function formatCurrencyInr(amount: number): string {
  const rupees = Math.max(0, Math.round(amount * 100) / 100);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(rupees);
}
