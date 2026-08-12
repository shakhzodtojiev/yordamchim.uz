"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";

export type TeacherActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function updateTeacherAction(
  teacherId: number,
  body: Partial<{
    full_name: string;
    is_admin: boolean;
    is_active: boolean;
    has_completed_onboarding: boolean;
  }>,
): Promise<TeacherActionResult> {
  try {
    await api.admin.updateTeacher(teacherId, body);
    revalidatePath("/admin/teachers");
    revalidatePath(`/admin/teachers/${teacherId}`);
    return { ok: true, data: null };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function updateTeacherPreferencesAction(
  teacherId: number,
  body: { subjects: number[]; grades: number[] },
): Promise<TeacherActionResult> {
  try {
    await api.admin.updateTeacherPreferences(teacherId, body);
    // List page renders subject/grade badges — must revalidate too so
    // reopening it doesn't show stale scoping.
    revalidatePath("/admin/teachers");
    revalidatePath(`/admin/teachers/${teacherId}`);
    return { ok: true, data: null };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function resetTeacherPasswordAction(
  teacherId: number,
): Promise<TeacherActionResult<{ password: string }>> {
  try {
    const result = await api.admin.resetTeacherPassword(teacherId);
    return { ok: true, data: result };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    throw error;
  }
}
