import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye, GraduationCap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TeacherEditForm } from "@/features/admin/teacher-edit-form";
import { TeacherWalletPanel } from "@/features/admin/teacher-wallet-panel";
import { ApiError } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";

export const dynamic = "force-dynamic";

export default async function AdminTeacherDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();

  let teacher;
  try {
    [teacher] = await Promise.all([api.admin.teacher(id)]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const [subjects, grades, wallet] = await Promise.all([
    api.subjects(),
    api.grades(),
    api.admin.teacherWallet(id),
  ]);

  return (
    <div className="max-w-4xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/admin/teachers">
          <ArrowLeft className="h-4 w-4" />
          O'qituvchilar
        </Link>
      </Button>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {teacher.full_name || teacher.email}
          </h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap text-sm text-muted-foreground">
            <span>{teacher.email}</span>
            <Badge variant={teacher.role === "admin" ? "success" : "outline"}>
              {teacher.role}
            </Badge>
            {teacher.has_completed_onboarding ? null : (
              <Badge variant="outline">Onboarding tugallanmagan</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <GraduationCap className="h-3 w-3" /> Test urinishlari
            </div>
            <div className="text-2xl font-semibold tabular-nums">
              {teacher.attempts_count}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Eye className="h-3 w-3" /> Taqdimot ko'rishlari
            </div>
            <div className="text-2xl font-semibold tabular-nums">
              {teacher.presentation_views_count}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Ro'yxatdan o'tgan</div>
            <div className="text-sm font-medium">
              {new Date(teacher.date_joined).toLocaleDateString("uz-UZ")}
            </div>
          </CardContent>
        </Card>
      </div>

      <TeacherWalletPanel teacherId={id} wallet={wallet} />

      <TeacherEditForm teacher={teacher} subjects={subjects} grades={grades} />
    </div>
  );
}
