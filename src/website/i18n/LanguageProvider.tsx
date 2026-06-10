import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { messages, type LangCode, type Messages } from "./messages";

const STORAGE_KEY = "navdhan-lang";

type LanguageContextValue = {
  lang: LangCode;
  setLang: (lang: LangCode) => void;
  t: Messages;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * Provides the active language + translated messages to the tree.
 * SSR-safe: renders English on the server, then adopts any stored preference
 * on the client after mount (so hydration matches).
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>("en");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && stored in messages) setLangState(stored as LangCode);
    } catch {
      /* localStorage unavailable — stay on default */
    }
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (next: LangCode) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore persistence failures */
    }
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: messages[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used within a LanguageProvider");
  return ctx;
}

/** Shorthand for the active translation dictionary. */
export function useT() {
  return useLang().t;
}
