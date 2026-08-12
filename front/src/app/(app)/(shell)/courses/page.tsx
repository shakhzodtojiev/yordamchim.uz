import Link from "next/link";
import { PlusCircle } from "lucide-react";

import { FadeUp, Stagger, StaggerItem } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { CourseCard } from "@/features/courses/course-card";
import { api } from "@/lib/api/endpoints";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const user = await api.me();

  // Admin gets the full catalogue (same shape as the teacher view uses) so
  // clicking "Kurslar" from the sidebar isn't gated by their own personal
  // subject × grade preferences — mirrors the /presentations branching.
  if (user.can_admin) {
    const admin = await api.admin.courses();
    return (
      <div className="max-w-6xl space-y-6">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Kurslar</h1>
            <p className="text-sm text-muted-foreground">
              Jami: {admin.count}. Admin sifatida barcha kurslarni ko'rasiz —
              chop etilgan + qoralamalar.
            </p>
          </div>
          <Button asChild>
            <Link href="/admin/courses/new">
              <PlusCircle className="h-4 w-4" />
              Yangi kurs
            </Link>
          </Button>
        </div>

        {admin.results.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
            Hozircha kurslar yo'q. "Yangi kurs" tugmasi orqali boshlang.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {admin.results.map((c) => (
              <Link key={c.id} href={`/admin/courses/${c.id}`} className="block">
                <CourseCard
                  item={{
                    ...c,
                    // AdminCourse has no per-user progress; fake 0/0 so the
                    // teacher-shaped card still renders sensibly.
                    lesson_count: c.lesson_count,
                    completed_count: 0,
                  }}
                />
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Teacher view — scoped by personalization.
  const list = await api.courses();

  return (
    <div className="space-y-6 max-w-6xl">
      <FadeUp>
        <header className="rounded-2xl border bg-soft-gradient p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Kurslar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Attestatsiyaga tayyorlash uchun modulli kurslar. Har darsni
            "Tamom" tugmasi bilan belgilang.
          </p>
        </header>
      </FadeUp>

      {list.results.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          Hozircha mos kurslar yo'q.
        </div>
      ) : (
        <Stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {list.results.map((c) => (
            <StaggerItem key={c.id}>
              <CourseCard item={c} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
