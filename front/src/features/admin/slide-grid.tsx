"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { Slide } from "@/types/api";

import { deleteSlideAction } from "./actions";

export function SlideGrid({
  slides,
  presentationId,
}: {
  slides: Slide[];
  presentationId: number;
}) {
  const [isPending, startTransition] = useTransition();

  const remove = (slideId: number) => {
    if (!confirm("Slaydni o'chirishni tasdiqlaysizmi?")) return;
    startTransition(async () => {
      try {
        await deleteSlideAction(slideId, presentationId);
        toast.success("Slayd o'chirildi.");
      } catch (e) {
        toast.error("O'chirish muvaffaqiyatsiz.");
      }
    });
  };

  if (slides.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Hozircha slaydlar yo'q. Yuqoridagi formadan rasm yuklang.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {slides.map((slide) => (
        <div
          key={slide.id}
          className="relative rounded-md border overflow-hidden bg-secondary/40 aspect-video group"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={slide.image_url}
            alt={`Slayd ${slide.order}`}
            className="h-full w-full object-cover no-select"
            draggable={false}
          />
          <span className="absolute top-1 left-1 rounded bg-black/60 text-white text-xs px-1.5 py-0.5 tabular-nums">
            {slide.order}
          </span>
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7"
            onClick={() => remove(slide.id)}
            disabled={isPending}
            aria-label="O'chirish"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}
