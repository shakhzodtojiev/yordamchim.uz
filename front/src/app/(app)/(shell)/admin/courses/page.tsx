import Link from "next/link";
import { BookOpen, PlusCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api/endpoints";

export const dynamic = "force-dynamic";

export default async function AdminCoursesPage() {
  const data = await api.admin.courses();

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kurslar</h1>
          <p className="text-sm text-muted-foreground">
            Jami: {data.count}. Kurs modul → dars strukturasida quriladi.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/courses/new">
            <PlusCircle className="h-4 w-4" />
            Yangi kurs
          </Link>
        </Button>
      </div>

      {data.results.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Hali kurslar yo'q. "Yangi kurs" tugmasi orqali boshlang.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.results.map((c) => (
            <Link key={c.id} href={`/admin/courses/${c.id}`}>
              <Card interactive className="h-full overflow-hidden">
                <div className="aspect-video bg-secondary/60 grid place-items-center">
                  {c.cover_image ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={c.cover_image} alt={c.title} className="h-full w-full object-cover" />
                  ) : (
                    <BookOpen className="h-8 w-8 text-muted-foreground/60" />
                  )}
                </div>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium leading-tight line-clamp-2">{c.title}</div>
                    {c.is_published ? (
                      <Badge variant="success">Chop etilgan</Badge>
                    ) : (
                      <Badge variant="outline">Qoralama</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 text-xs">
                    <Badge variant="secondary">{c.subject.name}</Badge>
                    <Badge variant="outline">{c.grade.name}</Badge>
                    {c.quarter ? (
                      <Badge variant="outline">{c.quarter}-chorak</Badge>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground border-t pt-2">
                    {c.lesson_count} dars
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
