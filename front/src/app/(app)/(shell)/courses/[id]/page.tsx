import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ModuleTree } from "@/features/courses/module-tree";
import { ApiError } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";

export const dynamic = "force-dynamic";

export default async function CourseDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();

  const course = await safeCourse(id);
  if (!course) notFound();

  const total = course.lesson_count || 0;
  const done = course.completed_count || 0;
  const pct =
    total > 0 ? Math.min(100, Math.max(0, Math.round((done / total) * 100))) : 0;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/courses" aria-label="Orqaga">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{course.title}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="secondary">{course.subject.name}</Badge>
            <Badge variant="outline">{course.grade.name}</Badge>
            {course.quarter ? (
              <Badge variant="outline">{course.quarter}-chorak</Badge>
            ) : null}
          </div>
        </div>
      </div>

      {course.description ? (
        <p className="text-sm text-muted-foreground max-w-3xl">
          {course.description}
        </p>
      ) : null}

      <div className="rounded-lg border p-4 space-y-2 max-w-md">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Progress</span>
          <span className="text-muted-foreground tabular-nums">
            {done} / {total} · {pct}%
          </span>
        </div>
        <Progress value={pct} className="h-2" />
      </div>

      <ModuleTree courseId={course.id} modules={course.modules} />
    </div>
  );
}

async function safeCourse(id: number) {
  try {
    return await api.course(id);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
      return null;
    }
    throw error;
  }
}
