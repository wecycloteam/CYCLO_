"use client";

import { useLanguage } from "@/lib/i18n";

export function LanguageToggle() {
  const { lang, setLang } = useLanguage();

  return (
    <button
      onClick={() => setLang(lang === "en" ? "sw" : "en")}
      aria-label={lang === "en" ? "Badilisha kwenda Kiswahili" : "Switch to English"}
      className="flex h-9 items-center rounded-full border border-[var(--chrome-border,var(--border))] bg-[var(--surface)] px-3 text-xs font-extrabold text-[var(--text-1)]"
    >
      {lang === "en" ? "SW" : "EN"}
    </button>
  );
}
