"use server";

import { redirect } from "next/navigation";

import { ApiError } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";
import type { SubmitAnswer } from "@/types/api";

export async function startAttemptAction(testId: number) {
  // Create-or-reuse the attempt here, in the POST context of a form action —
  // NOT on the GET render of /run. Idempotent server-side (reuses any live
  // in-progress attempt).
  try {
    await api.startAttempt(testId);
  } catch (error) {
    if (error instanceof ApiError) {
      // Mock closed / already taken / empty test — bounce back to the detail
      // page, which renders the reason.
      redirect(`/tests/${testId}`);
    }
    throw error;
  }
  redirect(`/tests/${testId}/run`);
}

export type SubmitResult =
  | { ok: true; attemptId: number }
  | { ok: false; error: string };

export async function submitAttemptAction(
  attemptId: number,
  answers: SubmitAnswer[],
): Promise<SubmitResult> {
  try {
    const result = await api.submitAttempt(attemptId, answers);
    return { ok: true, attemptId: result.id };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}
