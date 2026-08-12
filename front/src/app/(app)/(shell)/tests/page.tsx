import Link from "next/link";
import { Clock, ListChecks, PlusCircle } from "lucide-react";

import { FadeUp, Stagger, StaggerItem } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AdminTestsList } from "@/features/tests/admin-tests-list";
import { api } from "@/lib/api/endpoints";
import { formatPercent } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TestsPage() {
  const user = await api.me();

  if (user.can_admin) {
    const all = await api.admin.tests();
    return (
      <div className="max-w-6xl space-y-6">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Testlar</h1>
            <p className="text-sm text-muted-foreground">
              Jami: {all.count}. Admin sifatida barcha testlarni boshqarasiz —
              chop etilgan + qoralamalar.
            </p>
          </div>
          <Button asChild>
            <Link href="/tests/new">
              <PlusCircle className="h-4 w-4" />
              Yangi test
            </Link>
          </Button>
        </div>
        <AdminTestsList tests={all.results} />
      </div>
    );
  }

  // Teacher view — current behavior.
  const [tests, history] = await Promise.all([api.tests(), api.history()]);

  return (
    <div className="space-y-8 max-w-5xl">
      <FadeUp>
        <header className="rounded-2xl bg-soft-gradient p-6 sm:p-8 border">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Attestatsiya testlari
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Turli fanlar bo'yicha amaliyot testlari.
          </p>
        </header>
      </FadeUp>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Mavjud testlar</h2>
        {tests.results.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
            Hozircha testlar yo'q.
          </div>
        ) : (
          <Stagger className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {tests.results.map((t) => {
              const isMock = t.kind === "mock";
              const blocked = isMock && (!t.has_started || t.has_ended);
              const startsAt = t.available_from
                ? new Date(t.available_from).toLocaleString("uz-UZ")
                : null;
              const endsAt = t.available_until
                ? new Date(t.available_until).toLocaleString("uz-UZ")
                : null;
              return (
                <StaggerItem key={t.id}>
                <Link
                  href={`/tests/${t.id}`}
                  className="block hover:no-underline"
                  aria-disabled={blocked}
                >
                  <Card
                    interactive={!blocked}
                    className={`h-full ${blocked ? "opacity-60" : ""}`}
                  >
                    <CardHeader>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 flex-wrap">
                        {t.subjects.map((s) => (
                          <Badge key={s.id} variant="secondary">
                            {s.name}
                          </Badge>
                        ))}
                        {isMock ? (
                          <Badge variant="destructive">Mock</Badge>
                        ) : null}
                        {isMock && !t.has_started ? (
                          <Badge variant="outline">Boshlanmagan</Badge>
                        ) : null}
                        {isMock && t.has_ended ? (
                          <Badge variant="outline">Tugagan</Badge>
                        ) : null}
                      </div>
                      <CardTitle>{t.title}</CardTitle>
                      {t.description ? (
                        <CardDescription className="line-clamp-2">
                          {t.description}
                        </CardDescription>
                      ) : null}
                      {isMock && startsAt && endsAt ? (
                        <CardDescription className="text-xs mt-2">
                          {startsAt} — {endsAt}
                        </CardDescription>
                      ) : null}
                    </CardHeader>
                    <CardContent className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <ListChecks className="h-4 w-4" />
                        {t.questions_per_attempt} savol
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {Math.round(t.duration_seconds / 60)} daqiqa
                      </span>
                    </CardContent>
                  </Card>
                </Link>
                </StaggerItem>
              );
            })}
          </Stagger>
        )}
      </section>

      {history.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Oxirgi natijalar</h2>
          <Card>
            <CardContent className="p-0 divide-y">
              {history.map((h) => (
                <Link
                  key={h.id}
                  href={`/tests/attempts/${h.id}/results`}
                  className="flex items-center justify-between p-4 hover:bg-accent/40"
                >
                  <div>
                    <div className="font-medium">{h.test.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(h.started_at).toLocaleString("uz-UZ")}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      {h.correct_count}/{h.total_count}
                    </span>
                    <Badge variant={h.score >= 60 ? "success" : "destructive"}>
                      {formatPercent(h.score)}
                    </Badge>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
