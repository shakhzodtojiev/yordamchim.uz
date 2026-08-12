"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";

import type { ActionResult } from "./actions";

export async function createTestAction(
  body: Parameters<typeof api.admin.createTest>[0],
): Promise<ActionResult<{ id: number }>> {
  try {
    const created = await api.admin.createTest(body);
    revalidatePath("/tests");
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

export async function updateTestAction(
  testId: number,
  body: Parameters<typeof api.admin.updateTest>[1],
): Promise<ActionResult> {
  try {
    await api.admin.updateTest(testId, body);
    revalidatePath(`/tests/${testId}`);
    revalidatePath("/tests");
    return { ok: true, data: null };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

export async function togglePublishTestAction(
  testId: number,
  publish: boolean,
): Promise<void> {
  try {
    await api.admin.updateTest(testId, { is_published: publish });
    revalidatePath(`/tests/${testId}`);
    revalidatePath("/tests");
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw error;
  }
}

export async function deleteTestAction(testId: number): Promise<void> {
  try {
    await api.admin.deleteTest(testId);
    revalidatePath("/tests");
    redirect("/tests");
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw error;
  }
}

export async function createQuestionAction(
  poolId: number,
  form: FormData,
): Promise<ActionResult> {
  try {
    await api.admin.createQuestion(poolId, form);
    revalidatePath(`/admin/pools/${poolId}`);
    return { ok: true, data: null };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

export async function updateQuestionAction(
  questionId: number,
  poolId: number,
  form: FormData,
): Promise<ActionResult> {
  try {
    await api.admin.updateQuestion(questionId, form);
    revalidatePath(`/admin/pools/${poolId}`);
    return { ok: true, data: null };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

export async function deleteQuestionAction(
  questionId: number,
  poolId: number,
): Promise<ActionResult> {
  try {
    await api.admin.deleteQuestion(questionId);
    revalidatePath(`/admin/pools/${poolId}`);
    return { ok: true, data: null };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}
