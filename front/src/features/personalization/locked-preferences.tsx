import { Lock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { Grade, Subject } from "@/types/api";

type Props = {
  subjects: Subject[];
  grades: Grade[];
  selectedSubjectIds: number[];
  selectedGradeIds: number[];
};

export function LockedPreferences({
  subjects,
  grades,
  selectedSubjectIds,
  selectedGradeIds,
}: Props) {
  const subjectSet = new Set(selectedSubjectIds);
  const gradeSet = new Set(selectedGradeIds);
  const selectedSubjects = subjects.filter((s) => subjectSet.has(s.id));
  const selectedGrades = grades.filter((g) => gradeSet.has(g.id));

  return (
    <div className="space-y-6">
      <Section title="Fanlar">
        {selectedSubjects.length === 0 ? (
          <EmptyHint />
        ) : (
          <div className="flex flex-wrap gap-2">
            {selectedSubjects.map((s) => (
              <Badge key={s.id} variant="secondary" className="px-3 py-1 text-sm">
                {s.name}
              </Badge>
            ))}
          </div>
        )}
      </Section>

      <Section title="Sinflar">
        {selectedGrades.length === 0 ? (
          <EmptyHint />
        ) : (
          <div className="flex flex-wrap gap-2">
            {selectedGrades.map((g) => (
              <Badge key={g.id} variant="outline" className="px-3 py-1 text-sm">
                {g.name}
              </Badge>
            ))}
          </div>
        )}
      </Section>

      <div className="rounded-md border bg-muted/40 p-4 flex items-start gap-3 text-sm">
        <Lock className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
        <div className="space-y-1">
          <p className="font-medium">O'zgartirib bo'lmaydi</p>
          <p className="text-muted-foreground">
            Tayyorlangan o'quv materiallarining xavfsizligi uchun fan va
            sinflar bir martalik tanlanadi. Agar zarurat bo'lsa, administratorga
            murojaat qiling.
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function EmptyHint() {
  return (
    <p className="text-sm text-muted-foreground italic">Tanlanmagan.</p>
  );
}
