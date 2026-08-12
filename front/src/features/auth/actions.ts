"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { apiFetch, ApiError } from "@/lib/api/client";
import {
  clearAuthCookies,
  readRefreshToken,
  setAuthCookies,
} from "@/lib/api/cookies";
import { ROUTES } from "@/lib/constants";
import type { AuthSuccess } from "@/types/api";

// `fieldErrors` is hoisted to the common shape so form components can do
// `state?.fieldErrors?.email` without first narrowing on `ok`. Practically
// it's always undefined on success — the helper just keeps the call sites
// readable.
type ActionBase = { fieldErrors?: Record<string, string[]> };
export type ActionResult<T = unknown> =
  | (ActionBase & { ok: true; data: T })
  | (ActionBase & { ok: false; error: string });

const loginSchema = z.object({
  email: z.string().email("Email noto'g'ri."),
  password: z.string().min(1, "Parolni kiriting."),
});

const registerSchema = z.object({
  full_name: z.string().min(1, "Ism-familiyani kiriting."),
  email: z.string().email("Email noto'g'ri."),
  password: z
    .string()
    .min(8, "Parol kamida 8 ta belgidan iborat bo'lsin."),
  subjects: z
    .array(z.number().int().positive())
    .min(1, "Kamida bitta fanni tanlang."),
  grades: z
    .array(z.number().int().positive())
    .min(1, "Kamida bitta sinfni tanlang."),
});

/** Only allow same-site, absolute-path redirect targets. Rejects
 *  protocol-relative (`//evil.com`) and backslash (`/\evil.com`) tricks that
 *  browsers treat as off-site, and anything not starting with a single `/`. */
function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/")) return null;
  if (next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}

function flattenFieldErrors(data: unknown): Record<string, string[]> | undefined {
  if (!data || typeof data !== "object") return undefined;
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (Array.isArray(value)) out[key] = value.map(String);
    else if (typeof value === "string") out[key] = [value];
  }
  return Object.keys(out).length ? out : undefined;
}

export async function loginAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult<{ has_completed_onboarding: boolean; next?: string }>> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Iltimos, ma'lumotlarni to'g'ri kiriting.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const next = (formData.get("next") as string | null) ?? undefined;

  try {
    const result = await apiFetch<AuthSuccess>("/api/v1/auth/login/", {
      method: "POST",
      body: JSON.stringify(parsed.data),
      anonymous: true,
    });
    setAuthCookies(result.tokens);
    redirect(safeNext(next) ?? ROUTES.DASHBOARD);
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        ok: false,
        error: error.message,
        fieldErrors: flattenFieldErrors(error.data),
      };
    }
    throw error;
  }
}

export async function registerAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const subjectIds = formData.getAll("subjects").map((v) => Number(v)).filter(Number.isFinite);
  const gradeIds = formData.getAll("grades").map((v) => Number(v)).filter(Number.isFinite);
  const parsed = registerSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    password: formData.get("password"),
    subjects: subjectIds,
    grades: gradeIds,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Iltimos, ma'lumotlarni to'g'ri kiriting.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    const result = await apiFetch<AuthSuccess>("/api/v1/auth/register/", {
      method: "POST",
      body: JSON.stringify(parsed.data),
      anonymous: true,
    });
    setAuthCookies(result.tokens);
    redirect(ROUTES.DASHBOARD);
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        ok: false,
        error: error.message,
        fieldErrors: flattenFieldErrors(error.data),
      };
    }
    // Surface the real cause in container stderr — Next.js otherwise masks
    // server-action errors as generic 500s with a digest. NEXT_REDIRECT
    // throws come through here too (they're not ApiError); only log if it
    // looks like a real failure.
    const name = (error as { name?: string })?.name;
    if (name !== "NEXT_REDIRECT") {
      console.error("[registerAction] unexpected error:", error);
    }
    throw error;
  }
}

export async function logoutAction() {
  const refresh = readRefreshToken();
  try {
    if (refresh) {
      await apiFetch("/api/v1/auth/logout/", {
        method: "POST",
        body: JSON.stringify({ refresh }),
      });
    }
  } catch {
    // best-effort — clear cookies regardless
  }
  clearAuthCookies();
  redirect(ROUTES.LOGIN);
}
