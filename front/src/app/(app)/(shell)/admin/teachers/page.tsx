import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AdminTeacher } from "@/types/api";
import { api } from "@/lib/api/endpoints";

export const dynamic = "force-dynamic";

export default async function AdminTeachersPage({
  searchParams,
}: {
  searchParams: { search?: string };
}) {
  const data = await api.admin.teachers(searchParams.search);

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4" />
            Admin paneli
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight mt-2">O'qituvchilar</h1>
        <p className="text-sm text-muted-foreground">
          Jami: {data.count}.
        </p>
      </div>

      <form className="flex gap-2">
        <input
          type="search"
          name="search"
          defaultValue={searchParams.search ?? ""}
          placeholder="Email yoki ism..."
          className="flex-1 h-10 rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" variant="outline">Qidirish</Button>
      </form>

      {data.results.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Hech kim topilmadi.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: card stack */}
          <div className="md:hidden space-y-3">
            {data.results.map((t) => (
              <TeacherCard key={t.id} teacher={t} />
            ))}
          </div>

          {/* Desktop: table */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40 text-left">
                    <tr>
                      <Th>O'qituvchi</Th>
                      <Th>Fanlar</Th>
                      <Th>Sinflar</Th>
                      <Th className="text-right">Testlar</Th>
                      <Th className="text-right">Ko'rishlar</Th>
                      <Th>Oxirgi kirish</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.results.map((t) => (
                      <tr
                        key={t.id}
                        className="hover:bg-accent/30 cursor-pointer"
                      >
                        <Td>
                          <Link
                            href={`/admin/teachers/${t.id}`}
                            className="block"
                          >
                            <div className="font-medium hover:underline">
                              {t.full_name || t.email.split("@")[0]}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {t.email}
                            </div>
                          </Link>
                        </Td>
                        <Td>
                          <div className="flex flex-wrap gap-1">
                            {t.subjects.length === 0 ? (
                              <span className="text-xs text-muted-foreground italic">
                                tanlanmagan
                              </span>
                            ) : (
                              t.subjects.map((s) => (
                                <Badge key={s.id} variant="secondary">
                                  {s.name}
                                </Badge>
                              ))
                            )}
                          </div>
                        </Td>
                        <Td>
                          <div className="flex flex-wrap gap-1">
                            {t.grades.length === 0 ? (
                              <span className="text-xs text-muted-foreground italic">
                                —
                              </span>
                            ) : (
                              t.grades.map((g) => (
                                <Badge key={g.id} variant="outline">
                                  {g.name}
                                </Badge>
                              ))
                            )}
                          </div>
                        </Td>
                        <Td className="text-right tabular-nums">
                          {t.attempts_count}
                        </Td>
                        <Td className="text-right tabular-nums">
                          {t.presentation_views_count}
                        </Td>
                        <Td className="text-xs text-muted-foreground">
                          {t.last_login
                            ? new Date(t.last_login).toLocaleString("uz-UZ")
                            : "—"}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function TeacherCard({ teacher }: { teacher: AdminTeacher }) {
  return (
    <Link href={`/admin/teachers/${teacher.id}`} className="block">
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4 space-y-3">
          <div>
            <div className="font-medium">
              {teacher.full_name || teacher.email.split("@")[0]}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {teacher.email}
            </div>
          </div>
        <div className="flex flex-wrap gap-1">
          {teacher.subjects.map((s) => (
            <Badge key={s.id} variant="secondary">
              {s.name}
            </Badge>
          ))}
          {teacher.grades.map((g) => (
            <Badge key={g.id} variant="outline">
              {g.name}
            </Badge>
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground border-t pt-2">
          <span>
            <span className="tabular-nums">{teacher.attempts_count}</span> test
          </span>
          <span>
            <span className="tabular-nums">
              {teacher.presentation_views_count}
            </span>{" "}
            ko'rish
          </span>
          <span className="truncate ml-2">
            {teacher.last_login
              ? new Date(teacher.last_login).toLocaleDateString("uz-UZ")
              : "kirmagan"}
          </span>
        </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-3 font-medium text-xs uppercase tracking-wide text-muted-foreground ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}
