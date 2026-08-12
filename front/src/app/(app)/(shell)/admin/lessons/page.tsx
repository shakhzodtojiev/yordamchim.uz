import Link from "next/link";
import { PlusCircle, FileText, PlayCircle, ClipboardList } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api/endpoints";
import type { LessonKind } from "@/types/api";

export const dynamic = "force-dynamic";

const KIND_ICON: Record<LessonKind, typeof PlayCircle> = {
  video: PlayCircle,
  text: FileText,
  test: ClipboardList,
};

const KIND_LABEL: Record<LessonKind, string> = {
  video: "Video",
  text: "Matn",
  test: "Test",
};

export default async function AdminLessonsPage() {
  const data = await api.admin.lessons();

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Darslar kutubxonasi</h1>
          <p className="text-sm text-muted-foreground">
            Jami: {data.count}. Har dars kursda ham, tavsiya rejasida ham
            ishlatilishi mumkin.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/lessons/new">
            <PlusCircle className="h-4 w-4" />
            Yangi dars
          </Link>
        </Button>
      </div>

      {data.results.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Hali darslar yo'q. "Yangi dars" tugmasi orqali boshlang.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.results.map((l) => {
            const Icon = KIND_ICON[l.kind];
            return (
              <Link key={l.id} href={`/admin/lessons/${l.id}`}>
                <Card interactive className="h-full">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">
                        {KIND_LABEL[l.kind]}
                      </span>
                      {!l.is_published ? (
                        <Badge variant="outline" className="ml-auto text-[10px]">Qoralama</Badge>
                      ) : null}
                    </div>
                    <div className="font-medium line-clamp-2">{l.title}</div>
                    <div className="flex flex-wrap gap-1 text-xs">
                      <Badge variant="secondary">{l.subject.name}</Badge>
                      <Badge variant="outline">{l.grade.name}</Badge>
                      {l.topic_pool_name ? (
                        <Badge variant="outline">{l.topic_pool_name}</Badge>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
