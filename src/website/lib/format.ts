/** Format a number as Indian Rupees with no decimal places (e.g. ₹25,00,000). */
export const inr = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.round(value));
