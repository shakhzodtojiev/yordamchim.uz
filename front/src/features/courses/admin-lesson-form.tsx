"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Grade, LessonKind, Subject, Test } from "@/types/api";

import { createLessonAction, type ActionResult } from "./actions";

type TopicPoolOption = { id: number; title: string };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yaratish"}
    </Button>
  );
}

const inputClass =
  "flex h-10 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function AdminLessonCreateForm({
  subjects,
  grades,
  topicPools,
  tests,
}: {
  subjects: Subject[];
  grades: Grade[];
  topicPools: TopicPoolOption[];
  tests: Pick<Test, "id" | "title">[];
}) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    createLessonAction,
    null,
  );
  const [kind, setKind] = useState<LessonKind>("video");

  return (
    <form action={formAction} encType="multipart/form-data" className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="title">Sarlavha</Label>
        <Input id="title" name="title" required />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="kind">Turi</Label>
          <select
            id="kind"
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as LessonKind)}
            className={inputClass}
          >
            <option value="video">Video</option>
            <option value="text">Matn</option>
            <option value="test">Test</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="subject_id">Fan</Label>
          <select id="subject_id" name="subject_id" required className={inputClass} defaultValue="">
            <option value="" disabled>Tanlang...</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="grade_id">Sinf</Label>
          <select id="grade_id" name="grade_id" required className={inputClass} defaultValue="">
            <option value="" disabled>Tanlang...</option>
            {grades.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="topic_pool_id">
          Mavzu (topic pool) <span className="text-xs text-muted-foreground">— tavsiya uchun</span>
        </Label>
        <select id="topic_pool_id" name="topic_pool_id" className={inputClass} defaultValue="">
          <option value="">— tanlanmagan —</option>
          {topicPools.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
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

      {/* Kind-specific fields */}
      {kind === "video" ? (
        <div className="space-y-4 rounded-md border p-4 bg-secondary/20">
          <div className="space-y-2">
            <Label htmlFor="video_url">Video URL (YouTube / Vimeo / to'g'ri havola)</Label>
            <Input id="video_url" name="video_url" type="url" placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="video_file_upload">Yoki fayl yuklash (.mp4)</Label>
            <Input id="video_file_upload" name="video_file_upload" type="file" accept="video/*" />
            <p className="text-xs text-muted-foreground">
              URL yoki fayl — bittasi bo'lsa yetarli.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="duration_seconds">Davomiyligi (soniyada)</Label>
            <Input id="duration_seconds" name="duration_seconds" type="number" min={1} />
          </div>
        </div>
      ) : null}

      {kind === "text" ? (
        <div className="space-y-2 rounded-md border p-4 bg-secondary/20">
          <Label htmlFor="body">Matn</Label>
          <textarea
            id="body"
            name="body"
            rows={10}
            className="flex w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Dars matnini shu yerga yozing. Bosqich 2'da rich editor qo'shiladi."
          />
        </div>
      ) : null}

      {kind === "test" ? (
        <div className="space-y-2 rounded-md border p-4 bg-secondary/20">
          <Label htmlFor="test_id">Bog'lanadigan test</Label>
          <select id="test_id" name="test_id" className={inputClass} defaultValue="">
            <option value="" disabled>Tanlang...</option>
            {tests.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        </div>
      ) : null}

      <label className="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_published" defaultChecked />
        Chop etish (foydalanuvchilarga ko'rsatish)
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
