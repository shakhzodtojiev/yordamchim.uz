import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompleteButton } from "@/features/courses/complete-button";
import { VideoPlayer } from "@/features/courses/video-player";
import { ApiError } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";

export const dynamic = "force-dynamic";

export default async function LessonPage({
  params,
}: {
  params: { id: string; lessonId: string };
}) {
  const courseId = Number(params.id);
  const lessonId = Number(params.lessonId);
  if (!Number.isFinite(courseId) || !Number.isFinite(lessonId)) notFound();

  const [lesson, course] = await Promise.all([
    safeLesson(lessonId),
    safeCourse(courseId),
  ]);
  if (!lesson || !course) notFound();

  // `is_completed` is authoritative — it comes from LessonCompletion for the
  // authenticated user regardless of which course they entered through.
  // Deriving from the module tree would break deep-links where the lesson
  // lives in a different course.
  const initialCompleted = lesson.is_completed;

  const playbackUrl = lesson.video_file || lesson.video_url;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href={`/courses/${courseId}`} aria-label="Kursga qaytish">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight">{lesson.title}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="secondary">{lesson.subject.name}</Badge>
            <Badge variant="outline">{lesson.grade.name}</Badge>
            <Badge variant="outline">
              {lesson.kind === "video"
                ? "Video"
                : lesson.kind === "text"
                  ? "Matn"
                  : "Test"}
            </Badge>
          </div>
        </div>
      </div>

      {lesson.kind === "video" && playbackUrl ? (
        <VideoPlayer url={playbackUrl} title={lesson.title} />
      ) : null}

      {lesson.kind === "text" && lesson.body ? (
        // Bosqich 2'da TipTap output HTML sifatida keladi; hozircha
        // plain matn — Phase 1'da text kind minimal ishlaydi.
        <article className="prose prose-sm max-w-none whitespace-pre-wrap rounded-lg border p-6 bg-card">
          {lesson.body}
        </article>
      ) : null}

      {lesson.kind === "test" && lesson.test ? (
        <div className="rounded-lg border p-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            Bu dars test bilan bog'langan. Testni topshirish uchun quyidagi
            havolani bosing.
          </p>
          <Button asChild>
            <Link href={`/tests/${lesson.test}`}>Testga o'tish</Link>
          </Button>
        </div>
      ) : null}

      {lesson.description ? (
        <p className="text-sm text-muted-foreground max-w-3xl">
          {lesson.description}
        </p>
      ) : null}

      <div>
        <CompleteButton
          lessonId={lesson.id}
          courseId={courseId}
          initial={initialCompleted}
        />
      </div>
    </div>
  );
}

async function safeLesson(id: number) {
  try {
    return await api.lesson(id);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
      return null;
    }
    throw error;
  }
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
