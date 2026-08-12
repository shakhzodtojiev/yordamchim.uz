"use client";

import type { RefObject } from "react";

import { cn } from "@/lib/utils";

/** A toolbar button inserts a LaTeX snippet at the caret. The snippet may
 *  contain a `|` placeholder — after insertion, the caret is placed there
 *  (or the placeholder is replaced with the current selection) so the
 *  admin can keep typing without repositioning by hand. */
export type FormulaSnippet = {
  /** Short button label — rendered as literal text, so use unicode symbols
   *  (², √, ⁄) not LaTeX. Keep to 1–3 characters. */
  label: string;
  /** Longer hover tooltip. */
  title: string;
  /** LaTeX to insert. `|` marks the caret position; if the textarea has a
   *  selection when clicked, the selection replaces the `|` verbatim. */
  snippet: string;
  /** Non-empty label group used only for the visual separator. */
  group?: string;
};

const SNIPPETS: FormulaSnippet[] = [
  // Inline / block wrappers
  { label: "$…$", title: "Inline formula", snippet: "$|$" },
  { label: "$$…$$", title: "Blok formula", snippet: "$$|$$" },

  // Exponents / fractions / roots — the 80% case
  { label: "x²", title: "Daraja", snippet: "^{|}", group: "core" },
  { label: "x₁", title: "Pastki indeks", snippet: "_{|}", group: "core" },
  { label: "⁄", title: "Kasr", snippet: "\\frac{|}{}", group: "core" },
  { label: "√", title: "Kvadrat ildiz", snippet: "\\sqrt{|}", group: "core" },
  { label: "ⁿ√", title: "n-darajali ildiz", snippet: "\\sqrt[|]{}", group: "core" },
  { label: "( )", title: "O'zgaradigan qavs", snippet: "\\left( | \\right)", group: "core" },

  // Common operators
  { label: "·", title: "Ko'paytirish nuqta", snippet: "\\cdot ", group: "op" },
  { label: "×", title: "Ko'paytirish kesishtirilgan", snippet: "\\times ", group: "op" },
  { label: "÷", title: "Bo'lish", snippet: "\\div ", group: "op" },
  { label: "±", title: "Plyus-minus", snippet: "\\pm ", group: "op" },
  { label: "≤", title: "Kichikroq yoki teng", snippet: "\\leq ", group: "op" },
  { label: "≥", title: "Katta yoki teng", snippet: "\\geq ", group: "op" },
  { label: "≠", title: "Teng emas", snippet: "\\neq ", group: "op" },
  { label: "≈", title: "Taxminan", snippet: "\\approx ", group: "op" },
  { label: "∞", title: "Cheksizlik", snippet: "\\infty ", group: "op" },

  // Greek — a handful of the most common ones
  { label: "π", title: "Pi", snippet: "\\pi ", group: "greek" },
  { label: "α", title: "Alpha", snippet: "\\alpha ", group: "greek" },
  { label: "β", title: "Beta", snippet: "\\beta ", group: "greek" },
  { label: "θ", title: "Theta", snippet: "\\theta ", group: "greek" },
  { label: "Δ", title: "Delta (katta)", snippet: "\\Delta ", group: "greek" },

  // Calc + trig
  { label: "∫", title: "Integral", snippet: "\\int_{|}^{} ", group: "calc" },
  { label: "∑", title: "Yig'indi", snippet: "\\sum_{|}^{} ", group: "calc" },
  { label: "lim", title: "Limit", snippet: "\\lim_{|} ", group: "calc" },
  { label: "sin", title: "Sinus", snippet: "\\sin(|)", group: "calc" },
  { label: "cos", title: "Kosinus", snippet: "\\cos(|)", group: "calc" },
  { label: "log", title: "Logarifm", snippet: "\\log(|)", group: "calc" },
];

/** Insert `snippet` into the textarea at the current caret position. If the
 *  snippet contains a `|` placeholder AND the textarea has a selection, the
 *  selection replaces the placeholder. Otherwise the caret is placed where
 *  the `|` was so the admin can type. */
export function insertAtCursor(
  textarea: HTMLTextAreaElement,
  snippet: string,
  onChange: (v: string) => void,
) {
  const value = textarea.value;
  const start = textarea.selectionStart ?? value.length;
  const end = textarea.selectionEnd ?? value.length;
  const selected = value.slice(start, end);

  const placeholderIdx = snippet.indexOf("|");
  let insert: string;
  let caretOffset: number;
  if (placeholderIdx >= 0) {
    // Replace `|` with the current selection (or nothing if no selection);
    // caret lands right after the inserted selection so typing continues
    // in the placeholder position.
    insert =
      snippet.slice(0, placeholderIdx) +
      selected +
      snippet.slice(placeholderIdx + 1);
    caretOffset = placeholderIdx + selected.length;
  } else {
    insert = snippet;
    caretOffset = snippet.length;
  }

  const next = value.slice(0, start) + insert + value.slice(end);
  onChange(next);

  // React's onChange runs synchronously; the textarea value updates after
  // the state flush. Restore focus + caret on the next tick.
  requestAnimationFrame(() => {
    textarea.focus();
    const pos = start + caretOffset;
    textarea.setSelectionRange(pos, pos);
  });
}

export function FormulaToolbar({
  textareaRef,
  onChange,
}: {
  textareaRef: RefObject<HTMLTextAreaElement>;
  onChange: (value: string) => void;
}) {
  const click = (snippet: string) => {
    const el = textareaRef.current;
    if (!el) return;
    insertAtCursor(el, snippet, onChange);
  };

  let lastGroup: string | undefined = undefined;
  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-md border bg-muted/30 p-1">
      {SNIPPETS.map((s, i) => {
        const sep = s.group && s.group !== lastGroup && i !== 0;
        lastGroup = s.group;
        return (
          <span key={i} className="inline-flex items-center">
            {sep ? (
              <span
                aria-hidden
                className="mx-1 h-5 w-px bg-border"
              />
            ) : null}
            <button
              type="button"
              onClick={() => click(s.snippet)}
              title={s.title}
              className={cn(
                "h-7 min-w-[1.75rem] px-1.5 rounded text-xs font-mono",
                "hover:bg-accent hover:text-accent-foreground transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              {s.label}
            </button>
          </span>
        );
      })}
    </div>
  );
}
