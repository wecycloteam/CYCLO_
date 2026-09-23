// Toggles the html[data-theme] attribute the design tokens already define dark values
// for (packages/design-tokens/src/tokens.css). Dark is the app-wide default (matches the
// public landing page's teal/green hero) — set server-side in app/layout.tsx, not here.
// This module is for the toggle: reading/persisting a user's *explicit* choice to
// localStorage. DEFAULT_THEME is the fallback when nothing's been chosen yet — kept in
// sync with the `data-theme="dark"` layout.tsx renders by default.
const STORAGE_KEY = "cyclo.theme";
const DEFAULT_THEME: Theme = "dark";

export type Theme = "light" | "dark";

export function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

export function getSystemTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
}

export function initTheme(): Theme {
  const theme = getStoredTheme() ?? DEFAULT_THEME;
  applyTheme(theme);
  return theme;
}

export function setTheme(theme: Theme) {
  applyTheme(theme);
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private browsing / storage disabled — theme still applies for this page view.
  }
}
