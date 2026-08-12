import Link from "next/link";
import { ArrowLeft, Eye, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  deletePresentationAction,
  togglePublishAction,
} from "@/features/admin/actions";
import { PresentationMetaForm } from "@/features/admin/presentation-meta-form";
import type { AdminPresentation, Grade, Subject } from "@/types/api";

export function AdminPresentationDetail({
  admin,
  subjects,
  grades,
}: {
  admin: AdminPresentation;
  subjects: Subject[];
  grades: Grade[];
}) {
  const togglePublish = togglePublishAction.bind(
    null,
    admin.id,
    !admin.is_published,
  );
  const remove = deletePresentationAction.bind(null, admin.id);

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/presentations">
              <ArrowLeft className="h-4 w-4" />
              Taqdimotlar
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight mt-2">
            {admin.title}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary">{admin.subject.name}</Badge>
            <Badge variant="outline">{admin.grade.name}</Badge>
            {admin.quarter ? (
              <Badge variant="outline">{admin.quarter}-chorak</Badge>
            ) : null}
            {admin.is_published ? (
              <Badge variant="success">Chop etilgan</Badge>
            ) : (
              <Badge variant="outline">Qoralama</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button asChild variant="outline" size="sm">
            <Link href={`/presentations/${admin.id}?preview=1`}>
              <Eye className="h-3.5 w-3.5" />
              Ko'rib chiqish
            </Link>
          </Button>
          <form action={togglePublish}>
            <Button type="submit" variant="outline" size="sm">
              {admin.is_published ? "Chop etishni to'xtatish" : "Chop etish"}
            </Button>
          </form>
          <form action={remove}>
            <Button type="submit" variant="destructive" size="sm">
              <Trash2 className="h-3.5 w-3.5" />
              O'chirish
            </Button>
          </form>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Taqdimot ma'lumotlari</CardTitle>
          <CardDescription>
            Sarlavha, fan, sinf, tavsif va muqovani o'zgartiring.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PresentationMetaForm
            presentation={admin}
            subjects={subjects}
            grades={grades}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Slaydlar</div>
            <div className="text-2xl font-semibold tabular-nums">
              {admin.slide_count}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Eye className="h-3 w-3" /> Ko'rishlar
            </div>
            <div className="text-2xl font-semibold tabular-nums">
              {admin.view_count}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Yaratilgan</div>
            <div className="text-sm font-medium">
              {new Date(admin.created_at).toLocaleString("uz-UZ")}
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
