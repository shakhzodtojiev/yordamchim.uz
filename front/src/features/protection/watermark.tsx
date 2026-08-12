"use client";

import { useEffect, useState } from "react";

type Props = {
  /** Identifier shown in the watermark — usually the viewer's email. */
  text: string;
  /** Override for the rotation interval (ms). */
  intervalMs?: number;
};

/** Drifts the watermark to a new corner every `intervalMs` so a screenshot
 *  always catches the user's identifier somewhere on screen. Low opacity so
 *  it doesn't disturb reading, but visible enough to embarrass anyone who
 *  shares a screenshot. */
const POSITIONS: Array<{
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
}> = [
  { top: "12%", left: "8%" },
  { top: "16%", right: "10%" },
  { bottom: "14%", left: "10%" },
  { bottom: "18%", right: "8%" },
  { top: "48%", left: "6%" },
  { top: "52%", right: "6%" },
];

export function Watermark({ text, intervalMs = 8000 }: Props) {
  const [idx, setIdx] = useState(0);
  // Hydrate the date only after mount — server-side `toLocaleDateString`
  // resolves to a different format than the browser's locale, which would
  // cause a Next.js hydration mismatch on first paint.
  const [today, setToday] = useState<string>("");

  useEffect(() => {
    setToday(new Date().toLocaleDateString("uz-UZ"));
    const id = setInterval(() => {
      setIdx((i) => (i + 1) % POSITIONS.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  const pos = POSITIONS[idx];

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-40 select-none overflow-hidden"
    >
      {/* Tiled diagonal layer — barely-there text behind everything. */}
      <div
        className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage: `repeating-linear-gradient(
            -30deg,
            transparent 0,
            transparent 80px,
            currentColor 80px,
            currentColor 81px
          )`,
        }}
      />

      {/* Drifting label — rotates between corners every few seconds. */}
      <div
        className="absolute text-[11px] sm:text-xs font-medium text-foreground/35 transition-all duration-700 ease-in-out tracking-wide"
        style={{
          top: pos.top,
          bottom: pos.bottom,
          left: pos.left,
          right: pos.right,
        }}
      >
        Yordamchim · {text}
        {today ? ` · ${today}` : null}
      </div>
    </div>
  );
}
