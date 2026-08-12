"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Grade, Subject } from "@/types/api";

import { registerAction, type ActionResult } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ro'yxatdan o'tish"}
    </Button>
  );
}

type Props = { subjects: Subject[]; grades: Grade[] };

export function RegisterForm({ subjects, grades }: Props) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    registerAction,
    null,
  );
  const [selectedSubjects, setSelectedSubjects] = useState<Set<number>>(new Set());
  const [selectedGrades, setSelectedGrades] = useState<Set<number>>(new Set());

  const toggleSubject = (id: number) => {
    setSelectedSubjects((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleGrade = (id: number) => {
    setSelectedGrades((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="full_name">Ism-familiya</Label>
        <Input id="full_name" name="full_name" autoComplete="name" required />
        {state?.fieldErrors?.full_name?.[0] ? (
          <p className="text-xs text-destructive">
            {state.fieldErrors.full_name[0]}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
        {state?.fieldErrors?.email?.[0] ? (
          <p className="text-xs text-destructive">{state.fieldErrors.email[0]}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Parol</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        {state?.fieldErrors?.password?.[0] ? (
          <p className="text-xs text-destructive">
            {state.fieldErrors.password[0]}
          </p>
        ) : null}
      </div>

      <PickerSection
        label="Fanlar"
        hint="Dars beradigan fanlarni tanlang."
        items={subjects.map((s) => ({ id: s.id, label: s.name }))}
        selected={selectedSubjects}
        onToggle={toggleSubject}
      />
      {/* Hidden inputs so server action picks them up via FormData. */}
      {[...selectedSubjects].map((id) => (
        <input key={`s-${id}`} type="hidden" name="subjects" value={id} />
      ))}
      {state?.fieldErrors?.subjects?.[0] ? (
        <p className="text-xs text-destructive">
          {state.fieldErrors.subjects[0]}
        </p>
      ) : null}

      <PickerSection
        label="Sinflar"
        hint="Dars beradigan sinflarni tanlang."
        items={grades.map((g) => ({ id: g.id, label: g.name }))}
        selected={selectedGrades}
        onToggle={toggleGrade}
      />
      {[...selectedGrades].map((id) => (
        <input key={`g-${id}`} type="hidden" name="grades" value={id} />
      ))}
      {state?.fieldErrors?.grades?.[0] ? (
        <p className="text-xs text-destructive">
          {state.fieldErrors.grades[0]}
        </p>
      ) : null}

      {state && state.ok === false && !state.fieldErrors ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Diqqat: tanlangan fan va sinflarni keyinroq o'zgartirib bo'lmaydi.
      </p>

      <SubmitButton />

      <p className="text-center text-sm text-muted-foreground">
        Hisobingiz bormi?{" "}
        <Link
          href={ROUTES.LOGIN}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Kirish
        </Link>
      </p>
    </form>
  );
}

type PickerSectionProps = {
  label: string;
  hint: string;
  items: { id: number; label: string }[];
  selected: Set<number>;
  onToggle: (id: number) => void;
};

function PickerSection({
  label,
  hint,
  items,
  selected,
  onToggle,
}: PickerSectionProps) {
  return (
    <section className="space-y-2">
      <div>
        <Label>{label}</Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-md border p-2">
        {items.map((item) => {
          const isOn = selected.has(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item.id)}
              aria-pressed={isOn}
              className={cn(
                "flex items-center gap-2 rounded px-2 py-2 text-sm text-left transition-colors hover:bg-accent",
                isOn && "bg-primary/5 text-foreground",
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
