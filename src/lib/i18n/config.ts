export const locales = ["en", "hi", "bn", "te", "mr", "ta", "kn", "ml"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeLabels: Record<Locale, string> = {
  en: "English",
  hi: "हिन्दी",
  bn: "বাংলা",
  te: "తెలుగు",
  mr: "मराठी",
  ta: "தமிழ்",
  kn: "ಕನ್ನಡ",
  ml: "മലയാളം",
};

export const localeScripts: Record<Locale, string> = {
  en: "latin",
  hi: "devanagari",
  bn: "bengali",
  te: "telugu",
  mr: "devanagari",
  ta: "tamil",
  kn: "kannada",
  ml: "malayalam",
};

export function isValidLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export const localeOptions: { value: Locale; label: string; script: string }[] = locales.map(
  (value) => ({
    value,
    label: localeLabels[value],
    script: localeScripts[value],
  }),
);
