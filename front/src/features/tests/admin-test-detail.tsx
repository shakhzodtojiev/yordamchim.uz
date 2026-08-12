import Link from "next/link";
import { ArrowLeft, Library, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  deleteTestAction,
  togglePublishTestAction,
} from "@/features/admin/test-actions";
import { TestMetaForm } from "@/features/admin/test-meta-form";
import type { AdminPoolListItem, AdminTest } from "@/types/api";

const POOL_TYPE_LABEL = {
  oddiy: "Oddiy",
  nazariy: "Nazariy",
} as const;

const KIND_LABEL = {
  regular: "Oddiy",
  mock: "Mock",
} as const;

function formatWindow(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("uz-UZ");
}

export function AdminTestDetail({
  test,
  pools,
}: {
  test: AdminTest;
  pools: AdminPoolListItem[];
}) {
  const togglePublish = togglePublishTestAction.bind(
    null,
    test.id,
    !test.is_published,
  );
  const remove = deleteTestAction.bind(null, test.id);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/tests">
              <ArrowLeft className="h-4 w-4" />
              Testlar
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight mt-2">
            {test.title}
          </h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {test.subjects.map((s) => (
              <Badge key={s.id} variant="secondary">
                {s.name}
              </Badge>
            ))}
            <Badge
              variant={test.kind === "mock" ? "destructive" : "outline"}
            >
              {KIND_LABEL[test.kind]}
            </Badge>
            {test.is_published ? (
              <Badge variant="success">Chop etilgan</Badge>
            ) : (
              <Badge variant="outline">Qoralama</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <form action={togglePublish}>
            <Button type="submit" variant="outline" size="sm">
              {test.is_published ? "Chop etishni to'xtatish" : "Chop etish"}
            </Button>
          </form>
          <ConfirmDialog
            trigger={
              <Button type="button" variant="destructive" size="sm">
                <Trash2 className="h-3.5 w-3.5" />
                O'chirish
              </Button>
            }
            title="Testni o'chirish"
            description={`"${test.title}" testi va unga bog'liq attempt'lar tarixi butunlay o'chiriladi. Bu amalni qaytarib bo'lmaydi.`}
            confirmLabel="O'chirish"
            action={remove}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Library className="h-4 w-4" />
            To'plamlar ({test.pools.length})
          </CardTitle>
          <CardDescription>
            Bu test har attempt'da {test.questions_per_attempt} ta savol
            tortadi —{" "}
            {test.pools
              .map(
                (tp) =>
                  `${tp.pool.title} (${tp.easy_count + tp.medium_count + tp.hard_count})`,
              )
              .join(", ")}
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {test.pools.map((tp) => (
            <div
              key={tp.id}
              className="rounded-md border p-3 flex items-center justify-between gap-4 flex-wrap"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold">
                    {tp.order}
                  </span>
                  <span className="font-medium">{tp.pool.title}</span>
                  <Badge variant="secondary">{tp.pool.subject.name}</Badge>
                  <Badge variant="outline">
                    {POOL_TYPE_LABEL[tp.pool.pool_type]}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {tp.easy_count} oson + {tp.medium_count} o'rta +{" "}
                  {tp.hard_count} qiyin = {tp.easy_count + tp.medium_count + tp.hard_count}
                  {" "}/ bankda {tp.pool.question_count} savol
                </div>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/pools/${tp.pool.id}`}>Savollarni ko'rish</Link>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {test.kind === "mock" ? (
        <Card>
          <CardHeader>
            <CardTitle>Mock vaqt oralig'i</CardTitle>
            <CardDescription>
              Foydalanuvchilar faqat shu oraliqda boshlay oladi. Har
              foydalanuvchi bir martalik urinish.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Boshlanish</div>
              <div className="font-medium">
                {formatWindow(test.available_from)}
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Tugash</div>
              <div className="font-medium">
                {formatWindow(test.available_until)}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Test ma'lumotlari</CardTitle>
          <CardDescription>
            Sarlavha, to'plamlar, vaqt va tavsifni shu yerda tahrirlang.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TestMetaForm test={test} pools={pools} />
        </CardContent>
      </Card>
    </div>
  );
}
