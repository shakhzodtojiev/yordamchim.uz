"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Grade, Subject } from "@/types/api";

import { createCourseAction, type ActionResult } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yaratish"}
    </Button>
  );
}

const selectClass =
  "flex h-10 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function AdminCourseCreateForm({
  subjects,
  grades,
}: {
  subjects: Subject[];
  grades: Grade[];
}) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    createCourseAction,
    null,
  );

  return (
    <form action={formAction} encType="multipart/form-data" className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="title">Sarlavha</Label>
        <Input id="title" name="title" required />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="subject_id">Fan</Label>
          <select id="subject_id" name="subject_id" required className={selectClass} defaultValue="">
            <option value="" disabled>Tanlang...</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="grade_id">Sinf</Label>
          <select id="grade_id" name="grade_id" required className={selectClass} defaultValue="">
            <option value="" disabled>Tanlang...</option>
            {grades.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="quarter">Chorak</Label>
          <select id="quarter" name="quarter" className={selectClass} defaultValue="">
            <option value="">Tanlanmagan</option>
            <option value="1">1-chorak</option>
            <option value="2">2-chorak</option>
            <option value="3">3-chorak</option>
            <option value="4">4-chorak</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Tavsif (ixtiyoriy)</Label>
        <textarea
          id="description"
          name="description"
          rows={3}
          className="flex w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="cover_image">Muqova rasmi (ixtiyoriy)</Label>
        <Input id="cover_image" name="cover_image" type="file" accept="image/*" />
      </div>

      <label className="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_published" defaultChecked />
        Darhol chop etish
      </label>

      {state && state.ok === false ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <div className="flex gap-2 pt-2">
        <Submit />
      </div>
    </form>
  );
}
