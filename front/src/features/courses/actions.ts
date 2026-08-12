"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function readString(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

// ---- Teacher: mark lesson complete ----------------------------------------

export async function toggleLessonCompleteAction(
  lessonId: number,
  courseId: number,
): Promise<ActionResult<{ is_completed: boolean }>> {
  try {
    const result = await api.toggleLessonComplete(lessonId);
    // Backend returns either {is_completed: false} on delete or the created
    // row on create — normalise to a boolean so the caller doesn't care.
    const isCompleted =
      "is_completed" in result ? result.is_completed : true;
    revalidatePath(`/courses/${courseId}`);
    revalidatePath(`/courses/${courseId}/lessons/${lessonId}`);
    return { ok: true, data: { is_completed: isCompleted } };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

// ---- Admin: lesson CRUD ---------------------------------------------------

export async function createLessonAction(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const payload = buildLessonPayload(form);
  if ("error" in payload) return { ok: false, error: payload.error };

  try {
    const created = await api.admin.createLesson(payload.form);
    revalidatePath("/admin/lessons");
    redirect(`/admin/lessons/${created.id}`);
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function deleteLessonAction(lessonId: number) {
  try {
    await api.admin.deleteLesson(lessonId);
    revalidatePath("/admin/lessons");
    redirect("/admin/lessons");
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw error;
  }
}

function buildLessonPayload(
  form: FormData,
): { form: FormData } | { error: string } {
  const title = readString(form, "title");
  const kind = readString(form, "kind");
  const subjectId = readString(form, "subject_id");
  const gradeId = readString(form, "grade_id");

  if (!title) return { error: "Sarlavha kerak." };
  if (!kind) return { error: "Turini tanlang." };
  if (!subjectId) return { error: "Fanni tanlang." };
  if (!gradeId) return { error: "Sinfni tanlang." };

  const payload = new FormData();
  payload.set("title", title);
  payload.set("kind", kind);
  payload.set("subject_id", subjectId);
  payload.set("grade_id", gradeId);

  const description = readString(form, "description");
  if (description) payload.set("description", description);

  const topicPoolId = readString(form, "topic_pool_id");
  if (topicPoolId) payload.set("topic_pool_id", topicPoolId);

  const duration = readString(form, "duration_seconds");
  if (duration) payload.set("duration_seconds", duration);

  const isPublished = form.get("is_published") === "on";
  payload.set("is_published", isPublished ? "true" : "false");

  if (kind === "video") {
    const videoUrl = readString(form, "video_url");
    const videoFile = form.get("video_file_upload");
    if (videoUrl) payload.set("video_url", videoUrl);
    if (videoFile instanceof File && videoFile.size > 0) {
      payload.set("video_file_upload", videoFile);
    }
    if (!videoUrl && !(videoFile instanceof File && videoFile.size > 0)) {
      return { error: "Video URL yoki fayl kerak." };
    }
  } else if (kind === "text") {
    const body = readString(form, "body");
    if (!body) return { error: "Matn kerak." };
    payload.set("body", body);
  } else if (kind === "test") {
    const testId = readString(form, "test_id");
    if (!testId) return { error: "Test tanlang." };
    payload.set("test_id", testId);
  }

  return { form: payload };
}

// ---- Admin: course CRUD ---------------------------------------------------

export async function createCourseAction(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const title = readString(form, "title");
  const subjectId = readString(form, "subject_id");
  const gradeId = readString(form, "grade_id");
  const quarter = readString(form, "quarter");
  const description = readString(form, "description");
  const cover = form.get("cover_image");
  const isPublished = form.get("is_published") === "on";

  if (!title) return { ok: false, error: "Sarlavha kerak." };
  if (!subjectId) return { ok: false, error: "Fanni tanlang." };
  if (!gradeId) return { ok: false, error: "Sinfni tanlang." };

  const payload = new FormData();
  payload.set("title", title);
  payload.set("subject_id", subjectId);
  payload.set("grade_id", gradeId);
  if (quarter) payload.set("quarter", quarter);
  if (description) payload.set("description", description);
  payload.set("is_published", isPublished ? "true" : "false");
  if (cover instanceof File && cover.size > 0) {
    // Backend renamed the write field to disambiguate from the read
    // SerializerMethodField.
    payload.set("cover_image_upload", cover);
  }

  try {
    const created = await api.admin.createCourse(payload);
    revalidatePath("/admin/courses");
    redirect(`/admin/courses/${created.id}`);
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function updateCourseAction(
  courseId: number,
  form: FormData,
): Promise<ActionResult> {
  // Backend expects `cover_image_upload` for writes (see AdminCourseSerializer:
  // `cover_image` itself is a read-only SerializerMethodField). Rename the
  // field defensively so a future edit form that uses `cover_image` in its
  // HTML doesn't silently 400.
  const cover = form.get("cover_image");
  if (cover instanceof File && cover.size > 0) {
    form.delete("cover_image");
    form.set("cover_image_upload", cover);
  }
  try {
    await api.admin.updateCourse(courseId, form);
    revalidatePath("/admin/courses");
    revalidatePath(`/admin/courses/${courseId}`);
    return { ok: true, data: null };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function deleteCourseAction(courseId: number) {
  try {
    await api.admin.deleteCourse(courseId);
    revalidatePath("/admin/courses");
    redirect("/admin/courses");
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw error;
  }
}

export async function createModuleAction(
  courseId: number,
  form: FormData,
): Promise<ActionResult> {
  const title = readString(form, "title");
  if (!title) return { ok: false, error: "Modul nomi kerak." };
  try {
    await api.admin.createModule(courseId, { title });
    revalidatePath(`/admin/courses/${courseId}`);
    return { ok: true, data: null };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function deleteModuleAction(
  moduleId: number,
  courseId: number,
) {
  try {
    await api.admin.deleteModule(moduleId);
    revalidatePath(`/admin/courses/${courseId}`);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw error;
  }
}

export async function attachLessonAction(
  moduleId: number,
  lessonId: number,
  courseId: number,
): Promise<ActionResult> {
  try {
    await api.admin.attachLesson(moduleId, lessonId);
    revalidatePath(`/admin/courses/${courseId}`);
    return { ok: true, data: null };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function detachLessonAction(
  moduleLessonId: number,
  courseId: number,
) {
  try {
    await api.admin.detachLesson(moduleLessonId);
    revalidatePath(`/admin/courses/${courseId}`);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw error;
  }
}
