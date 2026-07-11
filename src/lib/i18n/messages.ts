import { defaultLocale, isValidLocale, type Locale } from "./config";
import en from "./messages/en.json";
import hi from "./messages/hi.json";
import bn from "./messages/bn.json";
import te from "./messages/te.json";
import mr from "./messages/mr.json";
import ta from "./messages/ta.json";
import kn from "./messages/kn.json";
import ml from "./messages/ml.json";

export type Messages = Record<string, unknown>;

const messagesByLocale: Record<Locale, Messages> = {
  en,
  hi,
  bn,
  te,
  mr,
  ta,
  kn,
  ml,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepMerge(target: Messages, source: Messages): Messages {
  const result: Messages = { ...target };
  for (const key of Object.keys(source)) {
    if (isRecord(source[key]) && isRecord(result[key])) {
      result[key] = deepMerge(result[key] as Messages, source[key] as Messages);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

export function getMessages(locale: string): Messages {
  if (!isValidLocale(locale)) {
    return messagesByLocale[defaultLocale];
  }
  if (locale === defaultLocale) {
    return messagesByLocale[locale];
  }
  return deepMerge(messagesByLocale[defaultLocale], messagesByLocale[locale]);
}
