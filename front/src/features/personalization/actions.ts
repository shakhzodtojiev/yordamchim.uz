"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";
import { ROUTES } from "@/lib/constants";

const schema = z.object({
  subjects: z
    .array(z.number().int().positive())
    .min(1, "Kamida bitta fanni tanlang."),
  grades: z
    .array(z.number().int().positive())
    .min(1, "Kamida bitta sinfni tanlang."),
});

export type SavePreferencesResult =
  | { ok: true }
  | { ok: false; error: string };

export async function savePreferences(input: {
  subjects: number[];
  grades: number[];
  redirectTo?: string;
}): Promise<SavePreferencesResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Noto'g'ri ma'lumot." };
  }

  try {
    await api.updatePreferences(parsed.data);
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  revalidatePath(ROUTES.DASHBOARD);
  revalidatePath(ROUTES.PRESENTATIONS);
  // Only same-site absolute paths — reject off-site (`//host`) targets.
  if (
    input.redirectTo &&
    input.redirectTo.startsWith("/") &&
    !input.redirectTo.startsWith("//") &&
    !input.redirectTo.startsWith("/\\")
  ) {
    redirect(input.redirectTo);
  }
  return { ok: true };
}
