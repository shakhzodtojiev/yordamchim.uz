"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Flag, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { ObjectionReason } from "@/types/api";

import { createObjectionAction } from "./actions";

const REASONS: Array<{ value: ObjectionReason; label: string }> = [
  { value: "wrong_answer", label: "Noto'g'ri javob" },
  { value: "wrong_question", label: "Noto'g'ri savol" },
  { value: "typo", label: "Imloviy xato" },
  { value: "unclear", label: "Tushunarsiz" },
  { value: "other", label: "Boshqa" },
];

type Props = {
  questionId: number;
  attemptId?: number | null;
  /** Tooltip / aria-label for the trigger button. */
  triggerLabel?: string;
  /** Render the trigger as a small icon-only chip (true) or a full button. */
  compact?: boolean;
};

export function ObjectionTrigger({
  questionId,
  attemptId,
  triggerLabel = "E'tiroz bildirish",
  compact = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ObjectionReason>("wrong_answer");
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();

  // Lock body scroll while the dialog is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ESC closes the dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const submit = () => {
    startTransition(async () => {
      const result = await createObjectionAction({
        question_id: questionId,
        attempt_id: attemptId ?? null,
        reason,
        body: body.trim(),
      });
      if (result.ok) {
        toast.success("E'tiroz yuborildi. Admin ko'rib chiqadi.");
        setOpen(false);
        setBody("");
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={triggerLabel}
          title={triggerLabel}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <Flag className="h-3.5 w-3.5" />
        </button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(true)}
        >
          <Flag className="h-3.5 w-3.5" />
          {triggerLabel}
        </Button>
      )}

      {open && typeof document !== "undefined"
        ? createPortal(
        // Portal — the shell's PageTransition wrapper keeps a residual
        // `transform: translateY(0)` after its mount animation, which CSS
        // makes a new containing block for any nested `fixed` element.
        // Rendering onto document.body bypasses that.
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 backdrop-blur-sm p-4 animate-fade-up"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border bg-card shadow-elevated-lg">
            <header className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Flag className="h-4 w-4 text-primary" />
                <h2 className="font-semibold">E'tiroz bildirish</h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Yopish"
              >
                <X className="h-4 w-4" />
              </Button>
            </header>

            <div className="p-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Savol yoki uning javoblarida xatolik bo'lsa, sababini tanlab,
                qo'shimcha izoh yozing. Admin ko'rib chiqadi.
              </p>

              <div className="space-y-2">
                <Label htmlFor="objection-reason">Sabab</Label>
                <select
                  id="objection-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value as ObjectionReason)}
                  className="flex h-10 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="objection-body">Izoh (ixtiyoriy)</Label>
                <textarea
                  id="objection-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  placeholder="Qo'shimcha tafsilotlar..."
                  className="flex w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>

            <footer className="flex items-center justify-end gap-2 p-4 border-t">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Bekor qilish
              </Button>
              <Button onClick={submit} disabled={isPending}>
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Yuborish"
                )}
              </Button>
            </footer>
          </div>
        </div>,
            document.body,
          )
        : null}
    </>
  );
}
