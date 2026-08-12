"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MathText } from "@/components/ui/math-text";
import type { AdminQuestion, Difficulty, QuestionType } from "@/types/api";

import { QuestionForm } from "./question-form";
import { deleteQuestionAction } from "./test-actions";

const TYPE_LABEL: Record<QuestionType, string> = {
  single: "Bitta to'g'ri",
  multi: "Bir nechta to'g'ri",
  matching: "Mos qo'yish",
};

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Oson",
  medium: "O'rta",
  hard: "Qiyin",
};

function SideThumb({ url, text }: { url: string | null; text: string }) {
  return (
    <div className="flex-1 flex items-center gap-2">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className="h-10 w-10 rounded border object-cover shrink-0"
        />
      ) : null}
      <MathText as="span" text={text} className="flex-1" />
    </div>
  );
}

export function QuestionList({
  questions,
  poolId,
}: {
  questions: AdminQuestion[];
  poolId: number;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const remove = (questionId: number) => {
    if (!confirm("Savolni o'chirishni tasdiqlaysizmi?")) return;
    startTransition(async () => {
      const result = await deleteQuestionAction(questionId, poolId);
      if (result.ok) {
        toast.success("Savol o'chirildi.");
      } else {
        toast.error(result.error);
      }
    });
  };

  if (questions.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Hozircha savollar yo'q. Pastdagi forma orqali birinchi savolni qo'shing.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {questions.map((q) =>
        editingId === q.id ? (
          <QuestionForm
            key={q.id}
            mode="edit"
            poolId={poolId}
            question={q}
            onDone={() => setEditingId(null)}
          />
        ) : (
          <Card key={q.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-xs text-muted-foreground">
                      Savol #{q.order}
                    </span>
                    <Badge variant="secondary">
                      {TYPE_LABEL[q.question_type]}
                    </Badge>
                    <Badge variant="outline">
                      {DIFFICULTY_LABEL[q.difficulty]}
                    </Badge>
                  </div>
                  <MathText
                    as="p"
                    text={q.text}
                    className="font-medium leading-snug"
                  />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditingId(q.id)}
                    aria-label="Tahrirlash"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(q.id)}
                    disabled={isPending}
                    aria-label="O'chirish"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>

              {q.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={q.image_url}
                  alt=""
                  className="rounded-md border max-h-48 w-auto"
                />
              ) : null}

              {q.question_type === "matching" ? (
                <ul className="space-y-1 text-sm">
                  {q.pairs.map((p, i) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-2 rounded px-2 py-1"
                    >
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold">
                        {i + 1}
                      </span>
                      <SideThumb url={p.left_image_url} text={p.left_text} />
                      <span className="text-muted-foreground">→</span>
                      <SideThumb url={p.right_image_url} text={p.right_text} />
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="space-y-1 text-sm">
                  {q.choices.map((c, i) => (
                    <li
                      key={c.id}
                      className={`flex items-center gap-2 rounded px-2 py-1 ${
                        c.is_correct ? "bg-emerald-100 dark:bg-emerald-900/30" : ""
                      }`}
                    >
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold">
                        {String.fromCharCode(65 + i)}
                      </span>
                      {c.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.image_url}
                          alt=""
                          className="h-12 w-12 rounded border object-cover"
                        />
                      ) : null}
                      <MathText as="span" text={c.text} className="flex-1" />
                      {c.is_correct ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ),
      )}
    </div>
  );
}
