import { en, type Messages } from "./en";
import { hi } from "./hi";
import { bn } from "./bn";
import { te } from "./te";
import { mr } from "./mr";
import { ta } from "./ta";
import { kn } from "./kn";
import { ml } from "./ml";

export type { Messages };

/** All locales, keyed by language code. `en` is the source of truth. */
export const messages = { en, hi, bn, te, mr, ta, kn, ml } satisfies Record<string, Messages>;

export type LangCode = keyof typeof messages;

/** Display order + native names for the language switcher. */
export const LANGUAGES: { code: LangCode; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "bn", label: "বাংলা" },
  { code: "te", label: "తెలుగు" },
  { code: "mr", label: "मराठी" },
  { code: "ta", label: "தமிழ்" },
  { code: "kn", label: "ಕನ್ನಡ" },
  { code: "ml", label: "മലയാളം" },
];
