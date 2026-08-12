"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";
import type { GenerationJob } from "@/types/api";

export type PurchaseResult =
  | { ok: true; balance: number | null }
  | { ok: false; error: string };

export async function purchasePresentationAction(
  id: number,
): Promise<PurchaseResult> {
  try {
    const res = await api.purchasePresentation(id);
    revalidatePath(`/presentations/${id}`);
    revalidatePath("/presentations");
    revalidatePath("/wallet");
    return { ok: true, balance: res.balance ?? null };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    throw error;
  }
}

const generateSchema = z.object({
  subject: z.number().int().positive(),
  grade: z.number().int().positive(),
  topic: z.string().trim().min(3, "Mavzu kamida 3 belgidan iborat bo'lsin."),
  num_slides: z.number().int().min(3).max(20),
  quarter: z.number().int().min(1).max(4).nullable().optional(),
  price: z.number().int().min(0),
  is_listed: z.boolean(),
});

export type GenerateResult =
  | { ok: true; jobId: number }
  | { ok: false; error: string };

export async function generatePresentationAction(
  input: z.input<typeof generateSchema>,
): Promise<GenerateResult> {
  const parsed = generateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Noto'g'ri ma'lumot.",
    };
  }

  try {
    const job = await api.generatePresentation(parsed.data);
    revalidatePath("/wallet");
    return { ok: true, jobId: job.id };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    throw error;
  }
}

/** Client status poller reads through this — a GET wrapped as an action so the
 *  jobs page can poll without exposing the API base to the browser. */
export async function pollGenerationJobAction(
  id: number,
): Promise<GenerationJob> {
  return api.generationJob(id);
}
