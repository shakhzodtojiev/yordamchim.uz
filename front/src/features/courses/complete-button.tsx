"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { toggleLessonCompleteAction } from "./actions";

export function CompleteButton({
  lessonId,
  courseId,
  initial,
}: {
  lessonId: number;
  courseId: number;
  initial: boolean;
}) {
  const [isCompleted, setIsCompleted] = useState(initial);
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    // Optimistic — the server round-trip usually completes fast enough
    // that a spinner-only UI feels laggy for a single click.
    const nextState = !isCompleted;
    setIsCompleted(nextState);
    startTransition(async () => {
      const result = await toggleLessonCompleteAction(lessonId, courseId);
      if (result.ok) {
        setIsCompleted(result.data.is_completed);
        toast.success(
          result.data.is_completed
            ? "Dars tugatildi."
            : "Belgi olib tashlandi.",
        );
      } else {
        // Roll back on failure.
        setIsCompleted(!nextState);
        toast.error(result.error);
      }
    });
  };

  return (
    <Button
      onClick={toggle}
      disabled={isPending}
      variant={isCompleted ? "outline" : "default"}
      size="lg"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isCompleted ? (
        <>
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          Tugatilgan — bekor qilish
        </>
      ) : (
        <>
          <Circle className="h-4 w-4" />
          Tamom
        </>
      )}
    </Button>
  );
}
