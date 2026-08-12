import Link from "next/link";
import { Library, PlusCircle, Sparkles } from "lucide-react";

import { FadeUp, Stagger, StaggerItem } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { AdminPresentationsFilters } from "@/features/presentations/admin-presentations-filters";
import { AdminPresentationsList } from "@/features/presentations/admin-presentations-list";
import { PresentationCard } from "@/features/presentations/presentation-card";
import { api } from "@/lib/api/endpoints";

export const dynamic = "force-dynamic";

// Narrow searchParam values into a valid int within [1..4] or the given
// grade id set — anything else is treated as "unset" so a stale/garbled
// URL never breaks the query.
function parseIntParam(
  raw: string | string[] | undefined,
  isValid: (n: number) => boolean,
): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number(value);
  return Number.isFinite(parsed) && isValid(parsed) ? parsed : null;
}

export default async function PresentationsPage({
  searchParams,
}: {
  searchParams: { subject?: string; grade?: string; quarter?: string };
}) {
  const user = await api.me();

  if (user.can_admin) {
    const [subjects, grades] = await Promise.all([
      api.subjects(),
      api.grades(),
    ]);
    const subjectIds = new Set(subjects.map((s) => s.id));
    const gradeIds = new Set(grades.map((g) => g.id));
    const subjectParam = parseIntParam(searchParams.subject, (n) =>
      subjectIds.has(n),
    );
    const gradeParam = parseIntParam(searchParams.grade, (n) => gradeIds.has(n));
    const quarterParam = parseIntParam(searchParams.quarter, (n) =>
      [1, 2, 3, 4].includes(n),
    );
    const data = await api.admin.presentations({
      subject: subjectParam ?? undefined,
      grade: gradeParam ?? undefined,
      quarter: quarterParam ?? undefined,
    });
    return (
      <div className="max-w-6xl space-y-6">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Taqdimotlar</h1>
            <p className="text-sm text-muted-foreground">
              Jami: {data.count}. Admin sifatida barcha taqdimotlarni
              boshqarasiz — chop etilgan + qoralamalar.
            </p>
          </div>
          <Button asChild>
            <Link href="/presentations/new">
              <PlusCircle className="h-4 w-4" />
              Yangi taqdimot
            </Link>
          </Button>
        </div>
        <AdminPresentationsFilters
          subjects={subjects}
          grades={grades}
          activeSubject={subjectParam}
          activeGrade={gradeParam}
          activeQuarter={quarterParam}
        />
        <AdminPresentationsList items={data.results} />
      </div>
    );
  }

  // Teacher view — always scoped to the teacher's (subject, grade) prefs.
  const list = await api.presentations();

  return (
    <div className="space-y-6 max-w-6xl">
      <FadeUp>
        <header className="rounded-2xl border bg-soft-gradient p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Taqdimotlar
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Tanlovlaringiz bo'yicha shaxsiylashtirilgan ro'yxat.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline">
                <Link href="/presentations/mine">
                  <Library className="h-4 w-4" />
                  Mening ijodim
                </Link>
              </Button>
              <Button asChild>
                <Link href="/presentations/create">
                  <Sparkles className="h-4 w-4" />
                  Taqdimot yaratish
                </Link>
              </Button>
            </div>
          </div>
        </header>
      </FadeUp>

      {list.results.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          Hozircha mos taqdimotlar yo'q.
        </div>
      ) : (
        <Stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {list.results.map((p) => (
            <StaggerItem key={p.id}>
              <PresentationCard item={p} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
