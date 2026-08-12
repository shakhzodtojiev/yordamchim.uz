import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GenerateForm } from "@/features/presentations/generate-form";
import { api } from "@/lib/api/endpoints";
import { ROUTES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function CreatePresentationPage() {
  const [prefs, subjects, grades] = await Promise.all([
    api.preferences(),
    api.subjects(),
    api.grades(),
  ]);
  const mySubjects = subjects.filter((s) => prefs.subjects.includes(s.id));
  const myGrades = grades.filter((g) => prefs.grades.includes(g.id));
  const ready = mySubjects.length > 0 && myGrades.length > 0;

  return (
    <div className="max-w-2xl space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={ROUTES.PRESENTATIONS}>
          <ArrowLeft className="h-4 w-4" />
          Taqdimotlar
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Taqdimot yaratish</CardTitle>
          <CardDescription>
            AI yordamida fan va sinf bo&apos;yicha slaydlar tayyorlanadi.
            Tayyor bo&apos;lgach xohlasangiz marketplace&apos;ga qo&apos;yasiz.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ready ? (
            <GenerateForm subjects={mySubjects} grades={myGrades} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Avval{" "}
              <Link href={ROUTES.SETTINGS} className="underline">
                Sozlamalar
              </Link>
              da fan va sinfingizni tanlang.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
