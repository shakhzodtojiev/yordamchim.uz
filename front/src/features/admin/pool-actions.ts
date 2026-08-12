"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";
import type { PoolType } from "@/types/api";

import type { ActionResult } from "./actions";

function readString(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(form: FormData, key: string): number | null {
  const value = form.get(key);
  if (typeof value !== "string" || !value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function createPoolAction(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const title = readString(form, "title");
  const description = readString(form, "description");
  const subjectId = readNumber(form, "subject_id");
  const poolType = (form.get("pool_type") as PoolType) ?? "oddiy";

  if (!title) return { ok: false, error: "Sarlavha kerak." };
  if (!subjectId) return { ok: false, error: "Fanni tanlang." };

  try {
    const created = await api.admin.createPool({
      title,
      description,
      subject_id: subjectId,
      pool_type: poolType,
    });
    revalidatePath("/admin/pools");
    redirect(`/admin/pools/${created.id}`);
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function updatePoolAction(
  poolId: number,
  body: Parameters<typeof api.admin.updatePool>[1],
): Promise<ActionResult> {
  try {
    await api.admin.updatePool(poolId, body);
    revalidatePath(`/admin/pools/${poolId}`);
    revalidatePath("/admin/pools");
    return { ok: true, data: null };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function deletePoolAction(poolId: number): Promise<void> {
  try {
    await api.admin.deletePool(poolId);
    revalidatePath("/admin/pools");
    redirect("/admin/pools");
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw error;
  }
}
