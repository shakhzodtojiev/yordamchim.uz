import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, ListChecks, Play } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { startAttemptAction } from "@/features/tests/actions";
import { AdminTestDetail } from "@/features/tests/admin-test-detail";
import { ApiError } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";
import { ROUTES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function TestDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();

  const user = await api.me();

  if (user.can_admin) {
    let test;
    try {
      test = await api.admin.test(id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    }
    const poolsPage = await api.admin.pools();
    return <AdminTestDetail test={test} pools={poolsPage.results} />;
  }

  // Teacher view — resolve the test by id (works past list page 1).
  let test;
  try {
    test = await api.test(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const isMock = test.kind === "mock";
  const blocked = isMock && (!test.has_started || test.has_ended);
  const startsAt = test.available_from
    ? new Date(test.available_from).toLocaleString("uz-UZ")
    : null;
  const endsAt = test.available_until
    ? new Date(test.available_until).toLocaleString("uz-UZ")
    : null;

  const startBound = startAttemptAction.bind(null, id);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={ROUTES.TESTS}>
          <ArrowLeft className="h-4 w-4" />
          Testlar ro'yxati
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {test.subjects.map((s) => (
              <Badge key={s.id} variant="secondary">
                {s.name}
              </Badge>
            ))}
            {isMock ? <Badge variant="destructive">Mock</Badge> : null}
            {isMock && !test.has_started ? (
              <Badge variant="outline">Boshlanmagan</Badge>
            ) : null}
            {isMock && test.has_ended ? (
              <Badge variant="outline">Tugagan</Badge>
            ) : null}
          </div>
          <CardTitle className="text-xl">{test.title}</CardTitle>
          {test.description ? (
            <CardDescription>{test.description}</CardDescription>
          ) : null}
          {isMock && startsAt && endsAt ? (
            <CardDescription className="text-xs mt-2">
              Vaqt oralig'i: {startsAt} — {endsAt}
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ListChecks className="h-3.5 w-3.5" />
                Savollar soni
              </div>
              <div className="mt-1 text-lg font-semibold">
                {test.questions_per_attempt}
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                Vaqt
              </div>
              <div className="mt-1 text-lg font-semibold">
                {Math.round(test.duration_seconds / 60)} daqiqa
              </div>
            </div>
          </div>

          <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
            <li>Vaqt tugagach javoblar avtomatik yuboriladi.</li>
            <li>Yakunlangach natija va xatolar ko'rsatiladi.</li>
            {isMock ? (
              <li>Mock testni faqat bir marta topshira olasiz.</li>
            ) : null}
          </ul>

          {blocked ? (
            <Button size="lg" className="w-full" disabled>
              {test.has_ended ? "Mock test tugagan" : "Mock test hali boshlanmagan"}
            </Button>
          ) : (
            <form action={startBound}>
              <Button type="submit" size="lg" className="w-full">
                <Play className="h-4 w-4" />
                Testni boshlash
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
