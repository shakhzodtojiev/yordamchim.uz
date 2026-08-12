import Link from "next/link";
import { CheckCircle2, Circle, FileText, PlayCircle, ClipboardList } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { CourseModule, LessonKind } from "@/types/api";

const KIND_ICON: Record<LessonKind, typeof PlayCircle> = {
  video: PlayCircle,
  text: FileText,
  test: ClipboardList,
};

const KIND_LABEL: Record<LessonKind, string> = {
  video: "Video",
  text: "Matn",
  test: "Test",
};

function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds < 1) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m} min` : `${m}:${s.toString().padStart(2, "0")}`;
}

export function ModuleTree({
  courseId,
  modules,
}: {
  courseId: number;
  modules: CourseModule[];
}) {
  if (modules.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Bu kursda hali darslar qo'shilmagan.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {modules.map((mod, idx) => (
        <section key={mod.id} className="rounded-lg border overflow-hidden">
          <header className="bg-secondary/40 px-4 py-3 border-b flex items-center gap-3">
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {idx + 1}-modul
            </span>
            <h3 className="font-semibold">{mod.title}</h3>
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {mod.lessons.length} dars
            </span>
          </header>

          {mod.lessons.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              Modulda darslar yo'q.
            </p>
          ) : (
            <ol className="divide-y">
              {mod.lessons.map((lesson) => {
                const Icon = KIND_ICON[lesson.kind];
                const duration = formatDuration(lesson.duration_seconds);
                return (
                  <li key={lesson.id}>
                    <Link
                      href={`/courses/${courseId}/lessons/${lesson.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors"
                    >
                      {lesson.is_completed ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground/50 shrink-0" />
                      )}
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="flex-1 text-sm font-medium">
                        {lesson.title}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {KIND_LABEL[lesson.kind]}
                      </Badge>
                      {duration ? (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {duration}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      ))}
    </div>
  );
}
