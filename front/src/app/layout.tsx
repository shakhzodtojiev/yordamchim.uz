import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import Script from "next/script";
import { Toaster } from "sonner";

import { TelegramProvider } from "@/components/telegram-provider";

import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap",
});

// Outfit — geometric display sans, used for luxury-feel hero headings.
const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Yordamchim — O‘qituvchilar uchun smart platforma",
  description:
    "Yordamchim — attestatsiya testlari va shaxsiylashtirilgan dars taqdimotlari uchun yagona platforma.",
};

// Runs synchronously before first paint so the layout knows whether we're
// inside Telegram. Without this, sidebar/topbar/bottom-nav flash for a tick
// before the provider can hide them. Mirrors next-themes' anti-flash trick.
const TMA_DETECT_SNIPPET = `
(function () {
  try {
    var tg = window.Telegram && window.Telegram.WebApp;
    if (!tg || !tg.initData) return;
    var html = document.documentElement;
    html.dataset.tma = "1";
    if (tg.colorScheme === "dark") html.classList.add("dark");
  } catch (e) { /* non-TMA; ignore */ }
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="uz"
      suppressHydrationWarning
      className={`${inter.variable} ${outfit.variable}`}
    >
      <head>
        {/* Telegram WebApp SDK — exposes window.Telegram.WebApp. Loads
            beforeInteractive so initData is available before our React
            tree mounts. Outside Telegram it's a no-op tiny script. */}
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        {/* Anti-flash early detection. */}
        <script dangerouslySetInnerHTML={{ __html: TMA_DETECT_SNIPPET }} />
      </head>
      <body className="min-h-screen bg-background font-sans">
        <TelegramProvider />
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
