import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { deleteLessonAction } from "@/features/courses/actions";
import { ApiError } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";

export const dynamic = "force-dynamic";

export default async function AdminLessonDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();

  let lesson;
  try {
    lesson = await api.admin.lesson(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const remove = deleteLessonAction.bind(null, lesson.id);

  return (
    <div className="max-w-3xl space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/admin/lessons">
          <ArrowLeft className="h-4 w-4" />
          Darslar
        </Link>
      </Button>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{lesson.title}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant="secondary">{lesson.subject.name}</Badge>
            <Badge variant="outline">{lesson.grade.name}</Badge>
            <Badge variant="outline">
              {lesson.kind === "video" ? "Video" : lesson.kind === "text" ? "Matn" : "Test"}
            </Badge>
            {lesson.topic_pool_name ? (
              <Badge variant="outline">{lesson.topic_pool_name}</Badge>
            ) : null}
            {lesson.is_published ? null : (
              <Badge variant="outline">Qoralama</Badge>
            )}
          </div>
        </div>
        <form action={remove}>
          <Button type="submit" variant="destructive" size="sm">
            <Trash2 className="h-3.5 w-3.5" />
            O'chirish
          </Button>
        </form>
      </div>

      <Card>
        <CardContent className="p-6 space-y-3">
          {lesson.description ? (
            <p className="text-sm text-muted-foreground">{lesson.description}</p>
          ) : null}

          {lesson.kind === "video" ? (
            <dl className="text-sm space-y-1">
              {lesson.video_url ? (
                <div>
                  <dt className="text-xs text-muted-foreground">Video URL</dt>
                  <dd className="font-mono text-xs break-all">{lesson.video_url}</dd>
                </div>
              ) : null}
              {lesson.video_file ? (
                <div>
                  <dt className="text-xs text-muted-foreground">Video fayl</dt>
                  <dd className="font-mono text-xs break-all">{lesson.video_file}</dd>
                </div>
              ) : null}
              {lesson.duration_seconds ? (
                <div>
                  <dt className="text-xs text-muted-foreground">Davomiyligi</dt>
                  <dd className="tabular-nums">{lesson.duration_seconds} soniya</dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          {lesson.kind === "text" ? (
            <div className="text-sm whitespace-pre-wrap">{lesson.body}</div>
          ) : null}

          {lesson.kind === "test" && lesson.test ? (
            <p className="text-sm">
              Bog'langan test:{" "}
              <Link href={`/admin/tests/${lesson.test}`} className="underline">
                #{lesson.test}
              </Link>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Tahrirlash Bosqich 2'da qo'shiladi. Hozircha o'chirib qayta yarating.
      </p>
    </div>
  );
}
