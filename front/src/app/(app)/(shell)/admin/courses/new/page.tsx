import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AdminCourseCreateForm } from "@/features/courses/admin-course-form";
import { api } from "@/lib/api/endpoints";

export const dynamic = "force-dynamic";

export default async function NewCoursePage() {
  const [subjects, grades] = await Promise.all([api.subjects(), api.grades()]);

  return (
    <div className="max-w-3xl space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/admin/courses">
          <ArrowLeft className="h-4 w-4" />
          Kurslar
        </Link>
      </Button>
      <h1 className="text-2xl font-bold tracking-tight">Yangi kurs</h1>
      <Card>
        <CardContent className="p-6">
          <AdminCourseCreateForm subjects={subjects} grades={grades} />
        </CardContent>
      </Card>
    </div>
  );
}
