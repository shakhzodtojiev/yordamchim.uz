"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Subject } from "@/types/api";

import type { ActionResult } from "./actions";
import { createPoolAction } from "./pool-actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yaratish"}
    </Button>
  );
}

export function PoolCreateForm({ subjects }: { subjects: Subject[] }) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    createPoolAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="title">Sarlavha</Label>
        <Input
          id="title"
          name="title"
          placeholder="Masalan: Kvadrat tenglamalar"
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="subject_id">Fan</Label>
          <select
            id="subject_id"
            name="subject_id"
            required
            className="flex h-10 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            defaultValue=""
          >
            <option value="" disabled>
              Tanlang...
            </option>
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
            name="pool_type"
            className="flex h-10 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            defaultValue="oddiy"
          >
            <option value="oddiy">Oddiy</option>
            <option value="nazariy">Nazariy</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Qisqacha tavsif</Label>
        <textarea
          id="description"
          name="description"
          rows={3}
          className="flex w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Bu to'plam haqida qisqacha"
        />
      </div>

      {state && state.ok === false ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <div className="pt-2">
        <Submit />
      </div>
    </form>
  );
}
