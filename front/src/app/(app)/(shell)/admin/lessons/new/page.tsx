import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AdminLessonCreateForm } from "@/features/courses/admin-lesson-form";
import { api } from "@/lib/api/endpoints";

export const dynamic = "force-dynamic";

export default async function NewLessonPage() {
  const [subjects, grades, poolsRes, testsRes] = await Promise.all([
    api.subjects(),
    api.grades(),
    // Full lists so the dropdowns aren't silently capped at 20 entries.
    api.admin.pools({ page_size: 500 }),
    api.admin.tests({ page_size: 500 }),
  ]);

  return (
    <div className="max-w-3xl space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/admin/lessons">
          <ArrowLeft className="h-4 w-4" />
          Darslar
        </Link>
      </Button>
      <h1 className="text-2xl font-bold tracking-tight">Yangi dars</h1>
      <Card>
        <CardContent className="p-6">
          <AdminLessonCreateForm
            subjects={subjects}
            grades={grades}
            topicPools={poolsRes.results.map((p) => ({ id: p.id, title: p.title }))}
            tests={testsRes.results.map((t) => ({ id: t.id, title: t.title }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
