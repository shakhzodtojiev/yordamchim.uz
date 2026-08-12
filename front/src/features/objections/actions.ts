"use server";

import { ApiError } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";
import type { ObjectionInput } from "@/types/api";

export type ObjectionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function createObjectionAction(
  body: ObjectionInput,
): Promise<ObjectionResult> {
  try {
    await api.createObjection(body);
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}
