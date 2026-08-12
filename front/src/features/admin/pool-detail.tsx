import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";

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
import type { AdminPool, Subject } from "@/types/api";

import { deletePoolAction } from "./pool-actions";
import { PoolMetaForm } from "./pool-meta-form";
import { QuestionForm } from "./question-form";
import { QuestionList } from "./question-list";

const POOL_TYPE_LABEL = {
  oddiy: "Oddiy",
  nazariy: "Nazariy",
} as const;

export function AdminPoolDetail({
  pool,
  subjects,
}: {
  pool: AdminPool;
  subjects: Subject[];
}) {
  const remove = deletePoolAction.bind(null, pool.id);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/admin/pools">
              <ArrowLeft className="h-4 w-4" />
              To'plamlar
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight mt-2">{pool.title}</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary">{pool.subject.name}</Badge>
            <Badge variant="outline">{POOL_TYPE_LABEL[pool.pool_type]}</Badge>
            <Badge variant="outline">{pool.question_count} savol</Badge>
          </div>
        </div>
        <ConfirmDialog
          trigger={
            <Button type="button" variant="destructive" size="sm">
              <Trash2 className="h-3.5 w-3.5" />
              O'chirish
            </Button>
          }
          title="To'plamni o'chirish"
          description={`"${pool.title}" to'plami va undagi barcha savollar butunlay o'chiriladi. Bu amalni qaytarib bo'lmaydi.`}
          confirmLabel="O'chirish"
          action={remove}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>To'plam ma'lumotlari</CardTitle>
          <CardDescription>
            Sarlavha, fan, va turini tahrirlang. Bu to'plamga bog'langan testlar
            ushbu o'zgarishlarni keyingi attempt'larda ko'rsatadi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PoolMetaForm pool={pool} subjects={subjects} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Savollar ({pool.questions.length})</CardTitle>
          <CardDescription>
            Savol turi: bitta to'g'ri javob, bir nechta to'g'ri javob, yoki mos
            qo'yish. Har savolga qiyinlik darajasi (oson / o'rta / qiyin)
            belgilanadi. Test attempt boshlanganida shu savollardan tasodifiy
            tanlanadi.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <QuestionList questions={pool.questions} poolId={pool.id} />
          <QuestionForm mode="create" poolId={pool.id} />
        </CardContent>
      </Card>
    </div>
  );
}
