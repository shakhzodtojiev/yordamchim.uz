"use client";

import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import type { TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

import { FormulaHelpButton } from "./formula-help";
import { FormulaToolbar } from "./formula-toolbar";
import { MathText } from "./math-text";

type BaseProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange" | "defaultValue"
>;

type Props = BaseProps & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Hide the preview panel — useful for tight inline choice inputs
   * where the preview would blow up the layout. */
  hidePreview?: boolean;
  /** Extra hint text below the preview. Defaults to a short LaTeX cheatsheet. */
  hint?: string | null;
  /** Hide the LaTeX toolbar + help button. Useful in tight rows where the
   *  parent form already has one visible toolbar. */
  hideToolbar?: boolean;
};

const DEFAULT_HINT =
  "Formula: inline $x^2$, blok $$\\frac{a}{b}$$. Belgilar: \\sqrt{x}, \\cdot, \\pm, \\leq";

/** Uncontrolled-friendly textarea with a live LaTeX preview underneath.
 *  Compatible with plain `<form>` submission — expose `name` and the
 *  textarea's value flows normally into FormData. Falls back to
 *  controlled mode if `value` + `onValueChange` are supplied. */
export const MathInput = forwardRef<HTMLTextAreaElement, Props>(
  function MathInput(
    {
      value,
      defaultValue,
      onValueChange,
      hidePreview,
      hint = DEFAULT_HINT,
      hideToolbar,
      className,
      rows = 3,
      ...rest
    },
    ref,
  ) {
    const [internal, setInternal] = useState(defaultValue ?? "");
    const current = value !== undefined ? value : internal;

    // Local ref so the toolbar can address the textarea even when the
    // caller passes no ref of their own. When the caller does pass a ref,
    // useImperativeHandle wires it up.
    const localRef = useRef<HTMLTextAreaElement | null>(null);
    useImperativeHandle(ref, () => localRef.current as HTMLTextAreaElement);

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const v = e.target.value;
        if (value === undefined) setInternal(v);
        onValueChange?.(v);
      },
      [onValueChange, value],
    );

    // Toolbar insert path — bypasses the DOM change event, so we update
    // state directly and let the DOM value follow via the value prop.
    const setValueFromToolbar = useCallback(
      (next: string) => {
        if (value === undefined) setInternal(next);
        onValueChange?.(next);
      },
      [onValueChange, value],
    );

    return (
      <div className="space-y-1.5">
        {!hideToolbar ? (
          <div className="flex items-start gap-2 flex-wrap">
            <div className="flex-1 min-w-0">
              <FormulaToolbar
                textareaRef={localRef}
                onChange={setValueFromToolbar}
              />
            </div>
            <FormulaHelpButton />
          </div>
        ) : null}
        <textarea
          ref={localRef}
          value={current}
          onChange={handleChange}
          rows={rows}
          className={cn(
            "flex w-full rounded-md border bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
          {...rest}
        />
        {!hidePreview ? (
          <div className="rounded-md border bg-muted/40 px-3 py-2 min-h-[2.5rem]">
            {current.trim() ? (
              <MathText
                text={current}
                as="div"
                className="text-sm leading-relaxed"
              />
            ) : (
              <span className="text-xs italic text-muted-foreground">
                Namuna shu yerda paydo bo'ladi
              </span>
            )}
          </div>
        ) : null}
        {hint ? (
          <p className="text-[11px] text-muted-foreground font-mono">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);
