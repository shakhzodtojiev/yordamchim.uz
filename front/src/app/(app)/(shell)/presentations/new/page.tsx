import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PresentationCreateForm } from "@/features/admin/presentation-create-form";
import { api } from "@/lib/api/endpoints";

export const dynamic = "force-dynamic";

export default async function NewPresentationPage() {
  const user = await api.me();
  if (!user.can_admin) notFound();

  const [subjects, grades] = await Promise.all([api.subjects(), api.grades()]);

  return (
    <div className="max-w-2xl space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/presentations">
          <ArrowLeft className="h-4 w-4" />
          Taqdimotlar
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Yangi taqdimot</CardTitle>
          <CardDescription>
            Avval ma'lumotlarni saqlang — keyingi qadamda slaydlarni yuklaysiz.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PresentationCreateForm subjects={subjects} grades={grades} />
        </CardContent>
      </Card>
    </div>
  );
}
