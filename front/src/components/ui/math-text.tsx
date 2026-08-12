"use client";

import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

import { cn } from "@/lib/utils";

/** Splits `text` into alternating literal and math segments. Math opens/
 * closes with `$$...$$` (display) or `$...$` (inline). Escaped `\$` is
 * treated as literal. Unclosed delimiters render as literal — never throw,
 * so admin typos don't crash the entire question card. */
type Segment =
  | { kind: "text"; value: string }
  | { kind: "math"; value: string; display: boolean };

function parseMath(text: string): Segment[] {
  const out: Segment[] = [];
  let i = 0;
  let lit = "";
  const flushLit = () => {
    if (lit) {
      out.push({ kind: "text", value: lit });
      lit = "";
    }
  };
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\\" && text[i + 1] === "$") {
      lit += "$";
      i += 2;
      continue;
    }
    if (ch === "$") {
      const display = text[i + 1] === "$";
      const delim = display ? "$$" : "$";
      const start = i + delim.length;
      // Find matching closing delimiter, skipping escaped dollars.
      let j = start;
      let found = -1;
      while (j < text.length) {
        if (text[j] === "\\" && text[j + 1] === "$") {
          j += 2;
          continue;
        }
        if (
          text[j] === "$" &&
          (display ? text[j + 1] === "$" : text[j + 1] !== "$")
        ) {
          found = j;
          break;
        }
        j++;
      }
      if (found === -1) {
        // Unclosed — fall through as literal.
        lit += ch;
        i++;
        continue;
      }
      flushLit();
      out.push({
        kind: "math",
        value: text.slice(start, found),
        display,
      });
      i = found + delim.length;
      continue;
    }
    lit += ch;
    i++;
  }
  flushLit();
  return out;
}

function renderMath(src: string, display: boolean): string {
  try {
    return katex.renderToString(src, {
      displayMode: display,
      throwOnError: false,
      strict: "ignore",
      output: "html",
    });
  } catch {
    // KaTeX shouldn't throw with throwOnError:false, but guard anyway.
    return `<span class="text-destructive">$${
      display ? "$" : ""
    }${escapeHtml(src)}$${display ? "$" : ""}</span>`;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Render arbitrary text with inline `$...$` and block `$$...$$` math
 * segments (LaTeX via KaTeX). Empty string renders empty. Whitespace
 * outside math is preserved verbatim (uses `whitespace-pre-wrap`). */
export function MathText({
  text,
  className,
  as: Tag = "span",
}: {
  text: string;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}) {
  const html = useMemo(() => {
    const segments = parseMath(text ?? "");
    return segments
      .map((seg) =>
        seg.kind === "text"
          ? escapeHtml(seg.value)
          : renderMath(seg.value, seg.display),
      )
      .join("");
  }, [text]);

  return (
    <Tag
      className={cn("whitespace-pre-wrap", className)}
      // Contents are either escaped literals or KaTeX-generated markup
      // (which produces safe span/svg trees — no user JS injection).
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
