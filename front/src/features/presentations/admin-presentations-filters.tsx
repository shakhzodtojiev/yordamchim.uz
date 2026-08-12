"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { Grade, Subject } from "@/types/api";

export function AdminPresentationsFilters({
  subjects,
  grades,
  activeSubject,
  activeGrade,
  activeQuarter,
}: {
  subjects: Subject[];
  grades: Grade[];
  activeSubject: number | null;
  activeGrade: number | null;
  activeQuarter: number | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    router.push(qs ? `/presentations?${qs}` : "/presentations");
  };

  const reset = () => router.push("/presentations");
  const hasFilter =
    activeSubject !== null || activeGrade !== null || activeQuarter !== null;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="filter-subject" className="text-xs">
          Fan
        </Label>
        <select
          id="filter-subject"
          value={activeSubject ?? ""}
          onChange={(e) => updateParam("subject", e.target.value)}
          className="flex h-10 min-w-[10rem] rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Barcha fanlar</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="filter-grade" className="text-xs">
          Sinf
        </Label>
        <select
          id="filter-grade"
          value={activeGrade ?? ""}
          onChange={(e) => updateParam("grade", e.target.value)}
          className="flex h-10 min-w-[10rem] rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Barcha sinflar</option>
          {grades.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="filter-quarter" className="text-xs">
          Chorak
        </Label>
        <select
          id="filter-quarter"
          value={activeQuarter ?? ""}
          onChange={(e) => updateParam("quarter", e.target.value)}
          className="flex h-10 min-w-[10rem] rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Barcha choraklar</option>
          <option value="1">1-chorak</option>
          <option value="2">2-chorak</option>
          <option value="3">3-chorak</option>
          <option value="4">4-chorak</option>
        </select>
      </div>

      {hasFilter ? (
        <Button variant="ghost" size="sm" onClick={reset}>
          <X className="h-3.5 w-3.5" />
          Tozalash
        </Button>
      ) : null}
    </div>
  );
}
