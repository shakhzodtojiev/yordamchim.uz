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

export async function createPresentationAction(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const title = readString(form, "title");
  const subjectId = readString(form, "subject_id");
  const gradeId = readString(form, "grade_id");
  const quarter = readString(form, "quarter");
  const description = readString(form, "description");
  const cover = form.get("cover_image");
  const pptx = form.get("pptx_file");
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
    payload.set("cover_image", cover);
  }
  if (pptx instanceof File && pptx.size > 0) {
    payload.set("pptx_file", pptx);
  }

  try {
    const created = await api.admin.createPresentation(payload);
    revalidatePath("/presentations");
    redirect(`/presentations/${created.id}`);
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

export async function uploadSlidesAction(
  presentationId: number,
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const files = form.getAll("slides").filter(
    (f): f is File => f instanceof File && f.size > 0,
  );
  if (files.length === 0) {
    return { ok: false, error: "Kamida bitta rasm tanlang." };
  }

  const payload = new FormData();
  for (const f of files) payload.append("slides", f);

  try {
    await api.admin.uploadSlides(presentationId, payload);
    revalidatePath(`/presentations/${presentationId}`);
    return { ok: true, data: { count: files.length } };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

export async function deleteSlideAction(slideId: number, presentationId: number) {
  try {
    await api.admin.deleteSlide(slideId);
    revalidatePath(`/presentations/${presentationId}`);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw error;
  }
}

export async function deletePresentationAction(presentationId: number) {
  try {
    await api.admin.deletePresentation(presentationId);
    revalidatePath("/presentations");
    redirect("/presentations");
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw error;
  }
}

export async function togglePublishAction(
  presentationId: number,
  publish: boolean,
) {
  const form = new FormData();
  form.set("is_published", publish ? "true" : "false");
  try {
    await api.admin.updatePresentation(presentationId, form);
    revalidatePath(`/presentations/${presentationId}`);
    revalidatePath("/presentations");
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw error;
  }
}

export async function updatePresentationAction(
  presentationId: number,
  form: FormData,
): Promise<ActionResult> {
  try {
    await api.admin.updatePresentation(presentationId, form);
    revalidatePath(`/presentations/${presentationId}`);
    revalidatePath("/presentations");
    return { ok: true, data: null };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}
