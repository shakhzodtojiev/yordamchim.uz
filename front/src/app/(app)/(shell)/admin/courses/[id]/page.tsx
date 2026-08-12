import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { deleteCourseAction } from "@/features/courses/actions";
import { AdminCourseTree } from "@/features/courses/admin-course-tree";
import { ApiError } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";

export const dynamic = "force-dynamic";

export default async function AdminCourseDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();

  let course;
  try {
    course = await api.admin.course(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  // For the "attach lesson" dropdown we surface the whole library scoped to
  // the course's subject+grade — cross-subject attachments are almost never
  // intentional and the filter keeps the list manageable.
  const lessonsRes = await api.admin.lessons({
    subject: course.subject.id,
    grade: course.grade.id,
  });

  const remove = deleteCourseAction.bind(null, course.id);

  return (
    <div className="max-w-5xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/admin/courses">
          <ArrowLeft className="h-4 w-4" />
          Kurslar
        </Link>
      </Button>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{course.title}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant="secondary">{course.subject.name}</Badge>
            <Badge variant="outline">{course.grade.name}</Badge>
            {course.quarter ? (
              <Badge variant="outline">{course.quarter}-chorak</Badge>
            ) : null}
            {course.is_published ? (
              <Badge variant="success">Chop etilgan</Badge>
            ) : (
              <Badge variant="outline">Qoralama</Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button asChild variant="outline" size="sm">
            <Link href={`/courses/${course.id}`}>
              <Eye className="h-3.5 w-3.5" />
              Ko'rib chiqish
            </Link>
          </Button>
          <form action={remove}>
            <Button type="submit" variant="destructive" size="sm">
              <Trash2 className="h-3.5 w-3.5" />
              O'chirish
            </Button>
          </form>
        </div>
      </div>

      {course.description ? (
        <p className="text-sm text-muted-foreground max-w-3xl">
          {course.description}
        </p>
      ) : null}

      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4">Modullar va darslar</h2>
          <AdminCourseTree
            course={course}
            availableLessons={lessonsRes.results.map((l) => ({
              id: l.id,
              title: l.title,
              kind: l.kind,
              subject: l.subject,
              grade: l.grade,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
