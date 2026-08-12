"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, PlayCircle, FileText, ClipboardList } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminCourse, AdminLesson, LessonKind } from "@/types/api";

import {
  attachLessonAction,
  createModuleAction,
  deleteModuleAction,
  detachLessonAction,
} from "./actions";

const KIND_ICON: Record<LessonKind, typeof PlayCircle> = {
  video: PlayCircle,
  text: FileText,
  test: ClipboardList,
};

const inputClass =
  "flex h-10 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type LessonOption = Pick<AdminLesson, "id" | "title" | "kind" | "subject" | "grade">;

export function AdminCourseTree({
  course,
  availableLessons,
}: {
  course: AdminCourse;
  availableLessons: LessonOption[];
}) {
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [attachSelection, setAttachSelection] = useState<Record<number, number | "">>({});
  const [isPending, startTransition] = useTransition();

  // Per-module dropdown filters out lessons already attached to that module —
  // the backend would 400 on re-attach otherwise (see AdminModuleLessonCreateView).
  const attachedByModule = new Map<number, Set<number>>();
  for (const mod of course.modules) {
    attachedByModule.set(
      mod.id,
      new Set(mod.lessons.map((entry) => entry.lesson.id)),
    );
  }

  const addModule = () => {
    if (!newModuleTitle.trim()) {
      toast.error("Modul nomi kerak.");
      return;
    }
    startTransition(async () => {
      const form = new FormData();
      form.set("title", newModuleTitle.trim());
      const result = await createModuleAction(course.id, form);
      if (result.ok) {
        setNewModuleTitle("");
        toast.success("Modul qo'shildi.");
      } else {
        toast.error(result.error);
      }
    });
  };

  const removeModule = (moduleId: number) => {
    if (!confirm("Modulni o'chirishni tasdiqlaysizmi?")) return;
    startTransition(async () => {
      try {
        await deleteModuleAction(moduleId, course.id);
        toast.success("Modul o'chirildi.");
      } catch {
        toast.error("O'chirish muvaffaqiyatsiz.");
      }
    });
  };

  const attachLesson = (moduleId: number) => {
    const lessonId = attachSelection[moduleId];
    if (!lessonId) {
      toast.error("Darsni tanlang.");
      return;
    }
    startTransition(async () => {
      const result = await attachLessonAction(moduleId, Number(lessonId), course.id);
      if (result.ok) {
        setAttachSelection((prev) => ({ ...prev, [moduleId]: "" }));
        toast.success("Dars biriktirildi.");
      } else {
        toast.error(result.error);
      }
    });
  };

  const detachLesson = (moduleLessonId: number) => {
    if (!confirm("Darsni moduldan olib tashlash?")) return;
    startTransition(async () => {
      try {
        await detachLessonAction(moduleLessonId, course.id);
        toast.success("Dars olib tashlandi.");
      } catch {
        toast.error("Olib tashlash muvaffaqiyatsiz.");
      }
    });
  };

  return (
    <div className="space-y-4">
      {course.modules.map((mod, idx) => (
        <section key={mod.id} className="rounded-lg border overflow-hidden">
          <header className="bg-secondary/40 px-4 py-3 border-b flex items-center gap-3">
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {idx + 1}-modul
            </span>
            <h3 className="font-semibold flex-1">{mod.title}</h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => removeModule(mod.id)}
              disabled={isPending}
              aria-label="Modulni o'chirish"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </header>

          {mod.lessons.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              Modulda darslar yo'q.
            </p>
          ) : (
            <ol className="divide-y">
              {mod.lessons.map((entry) => {
                const Icon = KIND_ICON[entry.lesson.kind];
                return (
                  <li
                    key={entry.id}
                    className="flex items-center gap-3 px-4 py-2.5"
                  >
                    <span className="text-xs tabular-nums text-muted-foreground w-6">
                      {entry.order}
                    </span>
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 text-sm">{entry.lesson.title}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => detachLesson(entry.id)}
                      disabled={isPending}
                      aria-label="Olib tashlash"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                );
              })}
            </ol>
          )}

          <div className="border-t p-3 flex gap-2 items-center bg-secondary/20">
            <select
              value={attachSelection[mod.id] ?? ""}
              onChange={(e) =>
                setAttachSelection((prev) => ({
                  ...prev,
                  [mod.id]: e.target.value === "" ? "" : Number(e.target.value),
                }))
              }
              className={inputClass}
            >
              <option value="">Dars tanlang...</option>
              {availableLessons
                .filter(
                  (l) => !(attachedByModule.get(mod.id)?.has(l.id) ?? false),
                )
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title} ({l.subject.name} · {l.grade.name})
                  </option>
                ))}
            </select>
            <Button
              type="button"
              onClick={() => attachLesson(mod.id)}
              disabled={isPending}
            >
              <Plus className="h-4 w-4" />
              Qo'shish
            </Button>
          </div>
        </section>
      ))}

      <section className="rounded-lg border border-dashed p-4 space-y-3">
        <Label htmlFor="new-module">Yangi modul</Label>
        <div className="flex gap-2">
          <Input
            id="new-module"
            value={newModuleTitle}
            onChange={(e) => setNewModuleTitle(e.target.value)}
            placeholder="Masalan: 1-modul. Kirish"
          />
          <Button onClick={addModule} disabled={isPending}>
            <Plus className="h-4 w-4" />
            Qo'shish
          </Button>
        </div>
      </section>
    </div>
  );
}
