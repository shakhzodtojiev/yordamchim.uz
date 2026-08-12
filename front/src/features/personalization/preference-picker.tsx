"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Grade, Subject } from "@/types/api";

import { savePreferences } from "./actions";

type Props = {
  subjects: Subject[];
  grades: Grade[];
  initialSubjectIds?: number[];
  initialGradeIds?: number[];
  submitLabel?: string;
  redirectTo?: string;
};

export function PreferencePicker({
  subjects,
  grades,
  initialSubjectIds = [],
  initialGradeIds = [],
  submitLabel = "Saqlash",
  redirectTo,
}: Props) {
  const [selectedSubjects, setSelectedSubjects] = useState<Set<number>>(
    () => new Set(initialSubjectIds),
  );
  const [selectedGrades, setSelectedGrades] = useState<Set<number>>(
    () => new Set(initialGradeIds),
  );
  const [isPending, startTransition] = useTransition();

  const canSubmit = useMemo(
    () => selectedSubjects.size > 0 && selectedGrades.size > 0,
    [selectedSubjects, selectedGrades],
  );

  const onSubmit = () => {
    if (!canSubmit) return;
    startTransition(async () => {
      const result = await savePreferences({
        subjects: [...selectedSubjects],
        grades: [...selectedGrades],
        redirectTo,
      });
      if (result.ok === false) {
        toast.error(result.error);
      } else {
        toast.success("Saqlandi.");
      }
    });
  };

  return (
    <div className="space-y-8">
      <PickerSection
        title="Fanlar"
        description="O'zingiz dars beradigan fanlarni tanlang."
        items={subjects.map((s) => ({ id: s.id, label: s.name }))}
        selected={selectedSubjects}
        onToggle={(id) => {
          setSelectedSubjects((prev) => toggle(prev, id));
        }}
      />

      <PickerSection
        title="Sinflar"
        description="Dars beradigan sinflarni tanlang."
        items={grades.map((g) => ({ id: g.id, label: g.name }))}
        selected={selectedGrades}
        onToggle={(id) => {
          setSelectedGrades((prev) => toggle(prev, id));
        }}
      />

      <div className="flex justify-end pt-2">
        <Button disabled={!canSubmit || isPending} onClick={onSubmit} size="lg">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : submitLabel}
        </Button>
      </div>
    </div>
  );
}

type PickerSectionProps = {
  title: string;
  description: string;
  items: { id: number; label: string }[];
  selected: Set<number>;
  onToggle: (id: number) => void;
};

function PickerSection({
  title,
  description,
  items,
  selected,
  onToggle,
}: PickerSectionProps) {
  return (
    <section>
      <header className="mb-3">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </header>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {items.map((item) => {
          const isOn = selected.has(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item.id)}
              aria-pressed={isOn}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm text-left transition-colors",
                "hover:bg-accent",
                isOn && "border-primary bg-primary/5 text-foreground",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "grid place-items-center h-4 w-4 shrink-0 rounded-sm border border-primary",
                  isOn && "bg-primary text-primary-foreground",
                )}
              >
                {isOn ? <Check className="h-3 w-3" /> : null}
              </span>
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function toggle(prev: Set<number>, id: number): Set<number> {
  const next = new Set(prev);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
