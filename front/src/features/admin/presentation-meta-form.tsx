"use client";

import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminPresentation, Grade, Quarter, Subject } from "@/types/api";

import { updatePresentationAction } from "./actions";

export function PresentationMetaForm({
  presentation,
  subjects,
  grades,
}: {
  presentation: AdminPresentation;
  subjects: Subject[];
  grades: Grade[];
}) {
  const [title, setTitle] = useState(presentation.title);
  const [description, setDescription] = useState(presentation.description ?? "");
  const [subjectId, setSubjectId] = useState<number>(presentation.subject.id);
  const [gradeId, setGradeId] = useState<number>(presentation.grade.id);
  const [quarter, setQuarter] = useState<Quarter | "">(
    presentation.quarter ?? "",
  );
  const [cover, setCover] = useState<File | null>(null);
  const [pptx, setPptx] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    if (!title.trim()) {
      toast.error("Sarlavha kerak.");
      return;
    }
    if (pptx) {
      const name = pptx.name.toLowerCase();
      if (!name.endsWith(".pptx") && !name.endsWith(".ppt")) {
        toast.error("Faqat .ppt yoki .pptx faylni tanlang.");
        return;
      }
    }
    startTransition(async () => {
      const form = new FormData();
      form.set("title", title.trim());
      form.set("description", description.trim());
      form.set("subject_id", String(subjectId));
      form.set("grade_id", String(gradeId));
      // Empty string clears the quarter on the backend (nullable field).
      form.set("quarter", quarter === "" ? "" : String(quarter));
      if (cover) form.set("cover_image", cover);
      if (pptx) form.set("pptx_file", pptx);
      const result = await updatePresentationAction(presentation.id, form);
      if (result.ok) {
        toast.success("Saqlandi.");
        setCover(null);
        setPptx(null);
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Sarlavha</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="subject_id">Fan</Label>
          <select
            id="subject_id"
            value={subjectId}
            onChange={(e) => setSubjectId(Number(e.target.value))}
            className="flex h-10 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="grade_id">Sinf</Label>
          <select
            id="grade_id"
            value={gradeId}
            onChange={(e) => setGradeId(Number(e.target.value))}
            className="flex h-10 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {grades.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="quarter">Chorak</Label>
          <select
            id="quarter"
            value={quarter}
            onChange={(e) =>
              setQuarter(
                e.target.value === ""
                  ? ""
                  : (Number(e.target.value) as Quarter),
              )
            }
            className="flex h-10 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Tanlanmagan</option>
            <option value="1">1-chorak</option>
            <option value="2">2-chorak</option>
            <option value="3">3-chorak</option>
            <option value="4">4-chorak</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Tavsif</Label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="flex w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="cover">Yangi muqova rasmi (ixtiyoriy)</Label>
        <Input
          id="cover"
          type="file"
          accept="image/*"
          onChange={(e) => setCover(e.target.files?.[0] ?? null)}
        />
        {presentation.cover_image ? (
          <p className="text-xs text-muted-foreground">
            Hozirgi muqova mavjud — yangisini tanlasangiz almashadi.
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="pptx">PowerPoint fayl (.ppt / .pptx, ixtiyoriy)</Label>
        <Input
          id="pptx"
          type="file"
          accept=".ppt,.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint"
          onChange={(e) => setPptx(e.target.files?.[0] ?? null)}
        />
        {presentation.pptx_filename ? (
          <p className="text-xs text-muted-foreground">
            Hozirgi fayl: <span className="font-medium">{presentation.pptx_filename}</span>{" "}
            — yangisi yuklansa almashadi.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Yuklasangiz, foydalanuvchilar Office Online viewer orqali to'liq
            taqdimotni (animatsiya/video bilan) ko'radilar.
          </p>
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Save className="h-4 w-4" />
              Saqlash
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
