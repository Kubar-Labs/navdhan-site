/** Initial slider values for the EMI calculator. */
export const EMI_DEFAULTS = {
  amount: 2_500_000, // ₹25L
  rate: 14, // % p.a.
  tenure: 36, // months
};

/** Min / max / step bounds for each EMI calculator slider. */
export const EMI_RANGES = {
  amount: { min: 500_000, max: 10_000_000, step: 50_000 },
  rate: { min: 9, max: 24, step: 0.1 },
  tenure: { min: 6, max: 84, step: 1 },
};
