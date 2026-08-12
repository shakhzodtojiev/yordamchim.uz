"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";
import type { ObjectionStatus } from "@/types/api";

export type AdminObjectionActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateObjectionAction(
  id: number,
  body: Partial<{ status: ObjectionStatus; admin_note: string }>,
): Promise<AdminObjectionActionResult> {
  try {
    await api.admin.updateObjection(id, body);
    revalidatePath("/admin/objections");
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}
