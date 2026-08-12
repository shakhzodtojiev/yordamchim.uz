"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";

export type WalletActionResult =
  | { ok: true; balance: number }
  | { ok: false; error: string };

export async function topupTeacherAction(
  id: number,
  amount: number,
  note?: string,
): Promise<WalletActionResult> {
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, error: "Summa musbat butun son bo'lishi kerak." };
  }
  try {
    const res = await api.admin.teacherWalletTopup(id, { amount, note });
    revalidatePath(`/admin/teachers/${id}`);
    return { ok: true, balance: res.balance };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function payoutTeacherAction(
  id: number,
  amount: number,
  note?: string,
): Promise<WalletActionResult> {
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, error: "Summa musbat butun son bo'lishi kerak." };
  }
  try {
    const res = await api.admin.teacherWalletPayout(id, { amount, note });
    revalidatePath(`/admin/teachers/${id}`);
    return { ok: true, balance: res.balance };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    throw error;
  }
}
