import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RegisterForm } from "@/features/auth/register-form";
import { apiFetch } from "@/lib/api/client";
import type { Grade, Subject } from "@/types/api";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  // Public endpoints — anonymous fetch (no auth required).
  const [subjects, grades] = await Promise.all([
    apiFetch<Subject[]>("/api/v1/personalization/subjects/", { anonymous: true }),
    apiFetch<Grade[]>("/api/v1/personalization/grades/", { anonymous: true }),
  ]);

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle>Yordamchim'ga qo'shiling</CardTitle>
        <CardDescription>
          O'qituvchi sifatida ro'yxatdan o'ting va o'zingizga mos kontentni oling.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm subjects={subjects} grades={grades} />
      </CardContent>
    </Card>
  );
}
