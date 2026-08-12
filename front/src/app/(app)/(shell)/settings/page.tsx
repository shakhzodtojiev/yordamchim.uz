import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LockedPreferences } from "@/features/personalization/locked-preferences";
import { api } from "@/lib/api/endpoints";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [subjects, grades, prefs] = await Promise.all([
    api.subjects(),
    api.grades(),
    api.preferences(),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Sozlamalar</h1>
        <p className="text-sm text-muted-foreground">
          Ro'yxatdan o'tish paytida tanlangan fan va sinflar.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Shaxsiylashtirish</CardTitle>
          <CardDescription>
            Faqat ushbu fan + sinf jufti bo'yicha kontent ko'rsatiladi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LockedPreferences
            subjects={subjects}
            grades={grades}
            selectedSubjectIds={prefs.subjects}
            selectedGradeIds={prefs.grades}
          />
        </CardContent>
      </Card>
    </div>
  );
}
