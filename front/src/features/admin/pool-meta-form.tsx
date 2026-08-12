"use client";

import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminPool, PoolType, Subject } from "@/types/api";

import { updatePoolAction } from "./pool-actions";

export function PoolMetaForm({
  pool,
  subjects,
}: {
  pool: AdminPool;
  subjects: Subject[];
}) {
  const [title, setTitle] = useState(pool.title);
  const [description, setDescription] = useState(pool.description ?? "");
  const [subjectId, setSubjectId] = useState<number>(pool.subject.id);
  const [poolType, setPoolType] = useState<PoolType>(pool.pool_type);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    if (!title.trim()) {
      toast.error("Sarlavha kerak.");
      return;
    }
    startTransition(async () => {
      const result = await updatePoolAction(pool.id, {
        title: title.trim(),
        description: description.trim(),
        subject_id: subjectId,
        pool_type: poolType,
      });
      if (result.ok) toast.success("To'plam yangilandi.");
      else toast.error(result.error);
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <Label htmlFor="pool_type">Turi</Label>
          <select
            id="pool_type"
            value={poolType}
            onChange={(e) => setPoolType(e.target.value as PoolType)}
            className="flex h-10 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="oddiy">Oddiy</option>
            <option value="nazariy">Nazariy</option>
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
