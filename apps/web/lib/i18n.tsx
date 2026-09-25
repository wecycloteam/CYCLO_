"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { sw } from "./translations/sw";

export type Lang = "en" | "sw";

const STORAGE_KEY = "cyclo.lang";

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  // Translation lookup keyed by the literal English source string — lets call sites read
  // as `t("Some English text")` without a separate key-naming scheme. Falls back to the
  // English input itself when nothing (or no Swahili entry) is found, so a missed string
  // degrades to English rather than showing a raw key or breaking the page.
  t: (text: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: "en",
  setLang: () => undefined,
  t: (text) => text,
});

export function getStoredLang(): Lang | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "sw" || v === "en" ? v : null;
  } catch {
    return null;
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const stored = getStoredLang();
    if (stored) setLangState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  function setLang(next: Lang) {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore — worst case the choice doesn't persist across reloads
    }
  }

  function t(text: string): string {
    if (lang !== "sw") return text;
    return sw[text] ?? text;
  }

  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
