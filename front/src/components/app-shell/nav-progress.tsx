"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// A thin top progress bar that fires on internal navigation. Two signals:
//   1. Click intercept on `<a href="/...">` — gives instant feedback the
//      moment the user taps, before the next route's RSC payload arrives.
//   2. Pathname change — clears the bar once Next.js commits the new tree.
// We never know the *real* download progress, so we ease toward 90% and
// snap to 100% on commit. Falls back gracefully under reduced-motion.
export function NavProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start: arm a slow climb toward 90%.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const link = (e.target as HTMLElement | null)?.closest?.("a");
      if (!link) return;
      const href = link.getAttribute("href");
      if (!href) return;
      if (link.target === "_blank") return;
      if (link.hasAttribute("download")) return;
      if (href.startsWith("http://") || href.startsWith("https://")) return;
      if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      // Same-page hash link — no navigation, skip.
      try {
        const url = new URL(link.href, window.location.href);
        if (
          url.pathname === window.location.pathname &&
          url.search === window.location.search
        ) {
          return;
        }
      } catch {
        // Not a parseable URL — bail out rather than show a phantom bar.
        return;
      }

      begin();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Commit: pathname changed → finish the bar.
  useEffect(() => {
    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const begin = () => {
    if (timer.current) clearInterval(timer.current);
    setActive(true);
    setProgress(8);
    timer.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) return p;
        // Decelerating climb — early jumps, slow tail.
        const step = Math.max(1, (90 - p) * 0.08);
        return Math.min(90, p + step);
      });
    }, 120);
  };

  const finish = () => {
    if (!active) return;
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    setProgress(100);
    // Hold at 100% briefly for the eye, then unmount.
    const t = setTimeout(() => {
      setActive(false);
      setProgress(0);
    }, 220);
    return () => clearTimeout(t);
  };

  if (!active) return null;

  return (
    <div
      data-app-shell="nav-progress"
      aria-hidden
      className="fixed inset-x-0 top-0 z-[60] h-0.5 pointer-events-none"
    >
      <div
        className="h-full bg-primary-gradient shadow-[0_0_8px_hsl(var(--primary)/0.45)] transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
