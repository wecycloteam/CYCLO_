"use client";

import { Languages } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export function LanguageToggle() {
  const { lang, setLang } = useLanguage();

  return (
    <button
      onClick={() => setLang(lang === "en" ? "sw" : "en")}
      aria-label={lang === "en" ? "Badilisha kwenda Kiswahili" : "Switch to English"}
      className="flex h-9 items-center gap-1 rounded-full border border-[var(--chrome-border,var(--border))] bg-[var(--surface)] px-3 text-xs font-extrabold text-[var(--text-1)]"
    >
      <Languages size={14} />
      {lang === "en" ? "SW" : "EN"}
    </button>
  );
}
