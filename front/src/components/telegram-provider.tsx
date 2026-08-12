"use client";

import { useEffect } from "react";

/**
 * Tiny client-only side-effect that wires the Telegram WebApp SDK to our app:
 *   - calls `WebApp.ready()` so Telegram knows we mounted
 *   - calls `WebApp.expand()` so the mini app uses full viewport on open
 *   - applies `themeParams` colours to our CSS variables
 *   - mirrors `colorScheme` to the `dark` class so Tailwind dark variants
 *     follow Telegram's mode automatically
 *   - re-runs the bridge on `themeChanged` and `viewportChanged` events
 *
 * The detection itself ALSO happens earlier via an inline script in
 * `layout.tsx` so no flash of the wrong chrome/topbar happens on first paint.
 */
export function TelegramProvider() {
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;

    try {
      tg.ready();
      tg.expand();
    } catch {
      // ready/expand can throw on very old WebApp versions — non-fatal.
    }

    const applyTheme = () => {
      const html = document.documentElement;
      // Tailwind dark-mode toggle.
      if (tg.colorScheme === "dark") html.classList.add("dark");
      else html.classList.remove("dark");

      // Map Telegram's hex theme params onto custom CSS variables. We keep
      // them on a separate namespace (`--tg-*`) so the rest of the app can
      // optionally opt-in via Tailwind utilities or custom rules without
      // overriding the brand palette globally.
      const root = document.documentElement.style;
      const theme = tg.themeParams || {};
      const map: Record<string, keyof typeof theme> = {
        "--tg-bg": "bg_color",
        "--tg-text": "text_color",
        "--tg-hint": "hint_color",
        "--tg-link": "link_color",
        "--tg-button": "button_color",
        "--tg-button-text": "button_text_color",
        "--tg-secondary-bg": "secondary_bg_color",
        "--tg-header-bg": "header_bg_color",
        "--tg-section-bg": "section_bg_color",
        "--tg-destructive": "destructive_text_color",
      };
      for (const [cssVar, themeKey] of Object.entries(map)) {
        const v = theme[themeKey];
        if (v) root.setProperty(cssVar, v);
        else root.removeProperty(cssVar);
      }
    };

    applyTheme();
    tg.onEvent("themeChanged", applyTheme);
    return () => {
      tg.offEvent("themeChanged", applyTheme);
    };
  }, []);

  return null;
}
