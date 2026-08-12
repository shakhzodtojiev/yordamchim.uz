"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminPoolListItem, AdminTest, TestKind } from "@/types/api";

import { updateTestAction } from "./test-actions";

type PoolRow = {
  pool_id: number | "";
  easy_count: number;
  medium_count: number;
  hard_count: number;
};

const EMPTY_ROW: PoolRow = {
  pool_id: "",
  easy_count: 5,
  medium_count: 5,
  hard_count: 5,
};

/** Backend ISO datetime → value usable by an <input type="datetime-local">. */
function toDatetimeLocal(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function TestMetaForm({
  test,
  pools,
}: {
  test: AdminTest;
  pools: AdminPoolListItem[];
}) {
  const [title, setTitle] = useState(test.title);
  const [description, setDescription] = useState(test.description ?? "");
  const [kind, setKind] = useState<TestKind>(test.kind);
  const [availableFrom, setAvailableFrom] = useState(
    toDatetimeLocal(test.available_from),
  );
  const [availableUntil, setAvailableUntil] = useState(
    toDatetimeLocal(test.available_until),
  );
  const [durationMinutes, setDurationMinutes] = useState(
    Math.round(test.duration_seconds / 60),
  );
  const [poolRows, setPoolRows] = useState<PoolRow[]>(() =>
    test.pools.length === 0
      ? [{ ...EMPTY_ROW }]
      : test.pools.map((tp) => ({
          pool_id: tp.pool.id,
          easy_count: tp.easy_count,
          medium_count: tp.medium_count,
          hard_count: tp.hard_count,
        })),
  );
  const [isPending, startTransition] = useTransition();

  const updateRow = (idx: number, patch: Partial<PoolRow>) =>
    setPoolRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    );
  const addRow = () => setPoolRows((prev) => [...prev, { ...EMPTY_ROW }]);
  const removeRow = (idx: number) =>
    setPoolRows((prev) => prev.filter((_, i) => i !== idx));

  const totalQuestions = poolRows.reduce(
    (acc, r) => acc + r.easy_count + r.medium_count + r.hard_count,
    0,
  );

  const submit = () => {
    if (!title.trim()) {
      toast.error("Sarlavha kerak.");
      return;
    }
    if (durationMinutes < 1) {
      toast.error("Vaqt kamida 1 daqiqa.");
      return;
    }
    if (poolRows.length === 0) {
      toast.error("Kamida bitta to'plam tanlang.");
      return;
    }
    const seenPools = new Set<number>();
    for (const row of poolRows) {
      if (row.pool_id === "" || row.pool_id === 0) {
        toast.error("Har qatorda to'plamni tanlang.");
        return;
      }
      if (seenPools.has(row.pool_id)) {
        toast.error("Bir xil to'plam bir necha marta tanlangan.");
        return;
      }
      seenPools.add(row.pool_id);
    }
    if (totalQuestions < 1) {
      toast.error("Har urinishda kamida bitta savol kerak.");
      return;
    }
    if (kind === "mock" && (!availableFrom || !availableUntil)) {
      toast.error("Mock test uchun boshlanish va tugash vaqti kerak.");
      return;
    }
    startTransition(async () => {
      const result = await updateTestAction(test.id, {
        title: title.trim(),
        description: description.trim(),
        pools_input: poolRows.map((r) => ({
          pool_id: Number(r.pool_id),
          easy_count: r.easy_count,
          medium_count: r.medium_count,
          hard_count: r.hard_count,
        })),
        kind,
        available_from:
          kind === "mock" ? new Date(availableFrom).toISOString() : null,
        available_until:
          kind === "mock" ? new Date(availableUntil).toISOString() : null,
        duration_seconds: durationMinutes * 60,
      });
      if (result.ok) {
        toast.success("Test ma'lumotlari yangilandi.");
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

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Mavzulashtirilgan to'plamlar</Label>
          <span className="text-xs text-muted-foreground">
            Jami har urinishda: {totalQuestions} savol
          </span>
        </div>
        <div className="space-y-2">
          {poolRows.map((row, idx) => (
            <PoolRowEditor
              key={idx}
              idx={idx}
              row={row}
              pools={pools}
              usedPoolIds={
                new Set(
                  poolRows
                    .filter((_, i) => i !== idx)
                    .map((r) => r.pool_id)
                    .filter((v): v is number => typeof v === "number"),
                )
              }
              onChange={(patch) => updateRow(idx, patch)}
              onRemove={poolRows.length > 1 ? () => removeRow(idx) : null}
            />
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRow}
          disabled={pools.length === 0}
        >
          <Plus className="h-4 w-4" />
          To'plam qo'shish
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="kind">Test turi</Label>
          <select
            id="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as TestKind)}
            className="flex h-10 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="regular">Oddiy</option>
            <option value="mock">Mock</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="duration">Vaqt (daqiqa)</Label>
          <Input
            id="duration"
            type="number"
            min={1}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
          />
        </div>
      </div>

      {kind === "mock" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-md border p-3 bg-muted/30">
          <div className="space-y-2">
            <Label htmlFor="available_from">Boshlanish vaqti</Label>
            <Input
              id="available_from"
              type="datetime-local"
              value={availableFrom}
              onChange={(e) => setAvailableFrom(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="available_until">Tugash vaqti</Label>
            <Input
              id="available_until"
              type="datetime-local"
              value={availableUntil}
              onChange={(e) => setAvailableUntil(e.target.value)}
            />
          </div>
        </div>
      ) : null}

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

function PoolRowEditor({
  idx,
  row,
  pools,
  usedPoolIds,
  onChange,
  onRemove,
}: {
  idx: number;
  row: PoolRow;
  pools: AdminPoolListItem[];
  usedPoolIds: Set<number>;
  onChange: (patch: Partial<PoolRow>) => void;
  onRemove: (() => void) | null;
}) {
  const subtotal = row.easy_count + row.medium_count + row.hard_count;
  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold shrink-0">
          {idx + 1}
        </span>
        <select
          value={row.pool_id}
          onChange={(e) =>
            onChange({
              pool_id:
                e.target.value === "" ? "" : Number(e.target.value),
            })
          }
          className="flex h-10 flex-1 rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">— to'plamni tanlang —</option>
          {pools.map((p) => {
            const isUsed = usedPoolIds.has(p.id);
            return (
              <option key={p.id} value={p.id} disabled={isUsed}>
                {p.title} ({p.subject.name}, {p.question_count} savol)
                {isUsed ? " — band" : ""}
              </option>
            );
          })}
        </select>
        {onRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label="Qatorni o'chirish"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Oson</Label>
          <Input
            type="number"
            min={0}
            value={row.easy_count}
            onChange={(e) => onChange({ easy_count: Number(e.target.value) })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">O'rta</Label>
          <Input
            type="number"
            min={0}
            value={row.medium_count}
            onChange={(e) =>
              onChange({ medium_count: Number(e.target.value) })
            }
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Qiyin</Label>
          <Input
            type="number"
            min={0}
            value={row.hard_count}
            onChange={(e) => onChange({ hard_count: Number(e.target.value) })}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Shu to'plamdan: {subtotal} savol
      </p>
    </div>
  );
}
