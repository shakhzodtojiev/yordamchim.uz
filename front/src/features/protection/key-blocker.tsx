"use client";

import { useEffect } from "react";

/** Side-effect-only component — blocks save/print/copy keyboard shortcuts
 *  and the right-click context menu while it's mounted on the page.
 *
 *  Caveat: this is a deterrent for casual users, not a security mechanism.
 *  A determined user can still take screenshots, open devtools (F12 is
 *  blocked here too but Cmd-Opt-I or via menu still works), or capture the
 *  screen. Pair with a watermark + audit log for actual leak tracing. */
export function KeyBlocker() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      // Save / Print / Find / Devtools / View source
      if (
        (meta && (key === "s" || key === "p" || key === "u")) ||
        key === "f12" ||
        // Devtools combos: Ctrl+Shift+I / Ctrl+Shift+J / Cmd+Opt+I etc.
        (meta && e.shiftKey && (key === "i" || key === "j" || key === "c"))
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const onContext = (e: MouseEvent) => {
      e.preventDefault();
    };
    const onDragStart = (e: DragEvent) => {
      // Block drag-out of images/iframes (a common quick-leak vector).
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    window.addEventListener("contextmenu", onContext);
    window.addEventListener("dragstart", onDragStart);
    return () => {
      window.removeEventListener("keydown", onKey, { capture: true } as never);
      window.removeEventListener("contextmenu", onContext);
      window.removeEventListener("dragstart", onDragStart);
    };
  }, []);

  return null;
}
