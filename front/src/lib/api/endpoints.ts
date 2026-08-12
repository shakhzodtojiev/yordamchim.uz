import "server-only";

import { cache } from "react";

import { PUBLIC_API_BASE_URL } from "@/lib/constants";
import type {
  AdminCourse,
  AdminLesson,
  AdminModule,
  AdminModuleLessonEntry,
  AdminObjection,
  AdminPool,
  AdminPoolListItem,
  AdminPresentation,
  AdminQuestion,
  AdminSlide,
  AdminStats,
  AdminTeacher,
  AdminTest,
  AdminTestListItem,
  AdminTestPoolInput,
  AdminWallet,
  AttemptHistoryItem,
  AttemptResult,
  AttemptStart,
  Course,
  CourseDetail,
  GenerationJob,
  Grade,
  Lesson,
  Objection,
  ObjectionInput,
  ObjectionStatus,
  Paginated,
  PoolType,
  Preferences,
  Presentation,
  PresentationDetail,
  Stats,
  Subject,
  SubmitAnswer,
  Test,
  TestKind,
  User,
  Wallet,
  WalletTransaction,
} from "@/types/api";

import { apiFetch } from "./client";

/** Backend returns relative paths for media so the value works regardless of
 *  the network the call traveled on. We prepend the browser-facing base here
 *  so image src tags Just Work in the rendered HTML. */
function absolutize(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${PUBLIC_API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function withAbsoluteCover<T extends Presentation>(p: T): T {
  return { ...p, cover_image: absolutize(p.cover_image) };
}

type WithImageUrl = { image_url: string | null };

function absolutizeChoice<T extends WithImageUrl>(c: T): T {
  return { ...c, image_url: absolutize(c.image_url) };
}

// Tolerant pair absolutizer — handles both the full results/admin pair
// (left + right images) and the attempt-time left-only prompt. Absolutizes
// whichever image keys are actually present.
function absolutizePair<T extends { left_image_url: string | null }>(p: T): T {
  const out = { ...p, left_image_url: absolutize(p.left_image_url) };
  const bag = out as Record<string, unknown>;
  if ("right_image_url" in p) {
    bag.right_image_url = absolutize(bag.right_image_url as string | null);
  }
  return out;
}

// Right-column option of a matching question during an attempt (tokenized).
function absolutizeOption<T extends { right_image_url: string | null }>(o: T): T {
  return { ...o, right_image_url: absolutize(o.right_image_url) };
}

function absolutizeQuestionLike<
  T extends WithImageUrl & {
    choices?: WithImageUrl[];
    pairs?: Array<{ left_image_url: string | null }>;
    options?: Array<{ right_image_url: string | null }>;
  },
>(q: T): T {
  const out: T = { ...q, image_url: absolutize(q.image_url) };
  if (q.choices) out.choices = q.choices.map(absolutizeChoice) as T["choices"];
  if (q.pairs) out.pairs = q.pairs.map(absolutizePair) as T["pairs"];
  if (q.options) out.options = q.options.map(absolutizeOption) as T["options"];
  return out;
}

function absolutizeAnswerResult<
  T extends {
    question_image_url: string | null;
    choices?: WithImageUrl[];
    pairs?: Array<{
      left_image_url: string | null;
      right_image_url: string | null;
    }>;
  },
>(a: T): T {
  const out: T = {
    ...a,
    question_image_url: absolutize(a.question_image_url),
  };
  if (a.choices) out.choices = a.choices.map(absolutizeChoice) as T["choices"];
  if (a.pairs) out.pairs = a.pairs.map(absolutizePair) as T["pairs"];
  return out;
}

export const api = {
  // Deduped per render pass — the (app), (shell) and admin layouts each call
  // me() while rendering one navigation; React.cache collapses those into a
  // single backend request (and a single token refresh) instead of 3-6.
  me: cache(() => apiFetch<User>("/api/v1/auth/me/")),

  subjects: () => apiFetch<Subject[]>("/api/v1/personalization/subjects/"),
  grades: () => apiFetch<Grade[]>("/api/v1/personalization/grades/"),

  preferences: () =>
    apiFetch<Preferences>("/api/v1/personalization/preferences/"),
  updatePreferences: (body: { subjects: number[]; grades: number[] }) =>
    apiFetch<Preferences>("/api/v1/personalization/preferences/", {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  presentations: async (
    params: { subject?: number; grade?: number } = {},
  ) => {
    const qs = new URLSearchParams();
    if (params.subject) qs.set("subject", String(params.subject));
    if (params.grade) qs.set("grade", String(params.grade));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    const data = await apiFetch<Paginated<Presentation>>(
      `/api/v1/presentations/${suffix}`,
    );
    return { ...data, results: data.results.map(withAbsoluteCover) };
  },
  recommendedPresentations: async () => {
    const data = await apiFetch<Presentation[]>(
      "/api/v1/presentations/recommended/",
    );
    return data.map(withAbsoluteCover);
  },
  presentation: async (id: number) => {
    const data = await apiFetch<PresentationDetail>(
      `/api/v1/presentations/${id}/`,
    );
    return {
      ...withAbsoluteCover(data),
      slides: data.slides.map((s) => ({
        ...s,
        image_url: absolutize(s.image_url) ?? "",
      })),
    };
  },

  // ---- Marketplace (teacher-facing) ----
  myPresentations: async () => {
    const data = await apiFetch<Paginated<Presentation>>(
      "/api/v1/presentations/mine/",
    );
    return { ...data, results: data.results.map(withAbsoluteCover) };
  },
  purchasedPresentations: async () => {
    const data = await apiFetch<Paginated<Presentation>>(
      "/api/v1/presentations/purchased/",
    );
    return { ...data, results: data.results.map(withAbsoluteCover) };
  },
  purchasePresentation: (id: number) =>
    apiFetch<{ owned: boolean; price_paid?: number; balance?: number }>(
      `/api/v1/presentations/${id}/purchase/`,
      { method: "POST", body: "{}" },
    ),
  generatePresentation: (body: {
    subject: number;
    grade: number;
    topic: string;
    num_slides: number;
    quarter?: number | null;
    price?: number;
    is_listed: boolean;
  }) =>
    apiFetch<GenerationJob>("/api/v1/presentations/generate/", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  generationJobs: () =>
    apiFetch<Paginated<GenerationJob>>(
      "/api/v1/presentations/generation-jobs/",
    ),
  generationJob: (id: number) =>
    apiFetch<GenerationJob>(`/api/v1/presentations/generation-jobs/${id}/`),

  // ---- Wallet (teacher-facing) ----
  walletMe: () => apiFetch<Wallet>("/api/v1/wallet/me/"),
  walletTransactions: () =>
    apiFetch<Paginated<WalletTransaction>>(
      "/api/v1/wallet/me/transactions/",
    ),

  tests: (params: { subject?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.subject) qs.set("subject", String(params.subject));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return apiFetch<Paginated<Test>>(`/api/v1/tests/${suffix}`);
  },
  // Single published test — resolves by id directly instead of scanning the
  // paginated list (which can't reach tests past page 1).
  test: (id: number) => apiFetch<Test>(`/api/v1/tests/${id}/`),
  startAttempt: async (testId: number) => {
    const data = await apiFetch<AttemptStart>(
      `/api/v1/tests/${testId}/start/`,
      { method: "POST", body: "{}" },
    );
    return { ...data, questions: data.questions.map(absolutizeQuestionLike) };
  },
  // GET the active in-progress attempt without creating one (the run page
  // reads through here so a GET never mutates).
  currentAttempt: async (testId: number) => {
    const data = await apiFetch<AttemptStart>(
      `/api/v1/tests/${testId}/current/`,
    );
    return { ...data, questions: data.questions.map(absolutizeQuestionLike) };
  },
  submitAttempt: async (attemptId: number, answers: SubmitAnswer[]) => {
    const data = await apiFetch<AttemptResult>(
      `/api/v1/tests/attempts/${attemptId}/submit/`,
      { method: "POST", body: JSON.stringify({ answers }) },
    );
    return { ...data, answers: data.answers.map(absolutizeAnswerResult) };
  },
  attempt: async (id: number) => {
    const data = await apiFetch<AttemptResult>(
      `/api/v1/tests/attempts/${id}/`,
    );
    return { ...data, answers: data.answers.map(absolutizeAnswerResult) };
  },
  history: () => apiFetch<AttemptHistoryItem[]>("/api/v1/tests/history/"),
  stats: () => apiFetch<Stats>("/api/v1/tests/stats/"),

  // Question objections — teacher creates one; lists their own.
  objections: () => apiFetch<Objection[]>("/api/v1/tests/objections/"),
  createObjection: (body: ObjectionInput) =>
    apiFetch<Objection>("/api/v1/tests/objections/", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  admin: {
    stats: () => apiFetch<AdminStats>("/api/v1/admin/stats/"),
    teachers: (search?: string) => {
      const qs = search ? `?search=${encodeURIComponent(search)}` : "";
      return apiFetch<Paginated<AdminTeacher>>(
        `/api/v1/admin/teachers/${qs}`,
      );
    },
    teacher: (id: number) =>
      apiFetch<AdminTeacher>(`/api/v1/admin/teachers/${id}/`),
    updateTeacher: (
      id: number,
      body: Partial<{
        full_name: string;
        is_admin: boolean;
        is_active: boolean;
        has_completed_onboarding: boolean;
      }>,
    ) =>
      apiFetch<AdminTeacher>(`/api/v1/admin/teachers/${id}/update/`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    updateTeacherPreferences: (
      id: number,
      body: { subjects: number[]; grades: number[] },
    ) =>
      apiFetch<{ subjects: number[]; grades: number[] }>(
        `/api/v1/admin/teachers/${id}/preferences/`,
        { method: "PUT", body: JSON.stringify(body) },
      ),
    resetTeacherPassword: (id: number) =>
      apiFetch<{ password: string }>(
        `/api/v1/admin/teachers/${id}/reset-password/`,
        { method: "POST", body: "{}" },
      ),
    teacherWallet: (id: number) =>
      apiFetch<AdminWallet>(`/api/v1/admin/teachers/${id}/wallet/`),
    teacherWalletTopup: (id: number, body: { amount: number; note?: string }) =>
      apiFetch<{ balance: number; amount: number }>(
        `/api/v1/admin/teachers/${id}/wallet/topup/`,
        { method: "POST", body: JSON.stringify(body) },
      ),
    teacherWalletPayout: (id: number, body: { amount: number; note?: string }) =>
      apiFetch<{ balance: number; amount: number }>(
        `/api/v1/admin/teachers/${id}/wallet/payout/`,
        { method: "POST", body: JSON.stringify(body) },
      ),
    presentations: async (
      params: { subject?: number; grade?: number; quarter?: number } = {},
    ) => {
      const qs = new URLSearchParams();
      if (params.subject) qs.set("subject", String(params.subject));
      if (params.grade) qs.set("grade", String(params.grade));
      if (params.quarter) qs.set("quarter", String(params.quarter));
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      const data = await apiFetch<Paginated<AdminPresentation>>(
        `/api/v1/admin/presentations/${suffix}`,
      );
      return {
        ...data,
        results: data.results.map((p) => ({
          ...p,
          cover_image: absolutize(p.cover_image),
        })),
      };
    },
    presentation: async (id: number) => {
      const data = await apiFetch<AdminPresentation>(
        `/api/v1/admin/presentations/${id}/`,
      );
      return { ...data, cover_image: absolutize(data.cover_image) };
    },
    createPresentation: (form: FormData) =>
      apiFetch<AdminPresentation>("/api/v1/admin/presentations/", {
        method: "POST",
        body: form,
      }),
    updatePresentation: (id: number, form: FormData) =>
      apiFetch<AdminPresentation>(`/api/v1/admin/presentations/${id}/`, {
        method: "PATCH",
        body: form,
      }),
    deletePresentation: (id: number) =>
      apiFetch<void>(`/api/v1/admin/presentations/${id}/`, {
        method: "DELETE",
      }),
    uploadSlides: (presentationId: number, form: FormData) =>
      apiFetch<AdminSlide[]>(
        `/api/v1/admin/presentations/${presentationId}/slides/`,
        { method: "POST", body: form },
      ),
    deleteSlide: (slideId: number) =>
      apiFetch<void>(`/api/v1/admin/slides/${slideId}/`, { method: "DELETE" }),

    // Topic pools (the question banks). `page_size` bumped high so callers
    // that need a complete list (e.g. the lesson-form topic-pool select)
    // get all rows in one shot instead of a silently truncated page 1.
    pools: (params: { page_size?: number } = {}) => {
      const qs = new URLSearchParams();
      if (params.page_size) qs.set("page_size", String(params.page_size));
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return apiFetch<Paginated<AdminPoolListItem>>(
        `/api/v1/admin/pools/${suffix}`,
      );
    },
    pool: async (id: number) => {
      const data = await apiFetch<AdminPool>(`/api/v1/admin/pools/${id}/`);
      return { ...data, questions: data.questions.map(absolutizeQuestionLike) };
    },
    createPool: (body: {
      title: string;
      description?: string;
      subject_id: number;
      pool_type: PoolType;
    }) =>
      apiFetch<AdminPool>("/api/v1/admin/pools/", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    updatePool: (
      id: number,
      body: Partial<{
        title: string;
        description: string;
        subject_id: number;
        pool_type: PoolType;
      }>,
    ) =>
      apiFetch<AdminPool>(`/api/v1/admin/pools/${id}/`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    deletePool: (id: number) =>
      apiFetch<void>(`/api/v1/admin/pools/${id}/`, { method: "DELETE" }),

    // Questions live under a pool now.
    createQuestion: async (poolId: number, form: FormData) => {
      const data = await apiFetch<AdminQuestion>(
        `/api/v1/admin/pools/${poolId}/questions/`,
        { method: "POST", body: form },
      );
      return absolutizeQuestionLike(data);
    },
    updateQuestion: async (questionId: number, form: FormData) => {
      const data = await apiFetch<AdminQuestion>(
        `/api/v1/admin/questions/${questionId}/`,
        { method: "PATCH", body: form },
      );
      return absolutizeQuestionLike(data);
    },
    deleteQuestion: (questionId: number) =>
      apiFetch<void>(`/api/v1/admin/questions/${questionId}/`, {
        method: "DELETE",
      }),

    // Tests reference a pool. Mock tests carry a window. `page_size` opt-in
    // so callers that need the full list (dropdowns) can request it without
    // silently seeing only page 1.
    tests: (params: { page_size?: number } = {}) => {
      const qs = new URLSearchParams();
      if (params.page_size) qs.set("page_size", String(params.page_size));
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return apiFetch<Paginated<AdminTestListItem>>(
        `/api/v1/admin/tests/${suffix}`,
      );
    },
    test: (id: number) =>
      apiFetch<AdminTest>(`/api/v1/admin/tests/${id}/`),
    createTest: (body: {
      title: string;
      description?: string;
      pools_input: AdminTestPoolInput[];
      kind: TestKind;
      available_from?: string | null;
      available_until?: string | null;
      duration_seconds: number;
      is_published?: boolean;
    }) =>
      apiFetch<AdminTest>("/api/v1/admin/tests/", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    updateTest: (
      id: number,
      body: Partial<{
        title: string;
        description: string;
        pools_input: AdminTestPoolInput[];
        kind: TestKind;
        available_from: string | null;
        available_until: string | null;
        duration_seconds: number;
        is_published: boolean;
      }>,
    ) =>
      apiFetch<AdminTest>(`/api/v1/admin/tests/${id}/`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    deleteTest: (id: number) =>
      apiFetch<void>(`/api/v1/admin/tests/${id}/`, { method: "DELETE" }),

    // Objections — admin triage. Filter by status via query param.
    objections: (params: { status?: ObjectionStatus; search?: string } = {}) => {
      const qs = new URLSearchParams();
      if (params.status) qs.set("status", params.status);
      if (params.search) qs.set("search", params.search);
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return apiFetch<AdminObjection[]>(`/api/v1/admin/objections/${suffix}`);
    },
    objection: (id: number) =>
      apiFetch<AdminObjection>(`/api/v1/admin/objections/${id}/`),
    updateObjection: (
      id: number,
      body: Partial<{ status: ObjectionStatus; admin_note: string }>,
    ) =>
      apiFetch<AdminObjection>(`/api/v1/admin/objections/${id}/`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),

    // Courses — admin CRUD
    lessons: async (
      params: {
        subject?: number;
        grade?: number;
        kind?: string;
        search?: string;
      } = {},
    ) => {
      const qs = new URLSearchParams();
      if (params.subject) qs.set("subject", String(params.subject));
      if (params.grade) qs.set("grade", String(params.grade));
      if (params.kind) qs.set("kind", params.kind);
      if (params.search) qs.set("search", params.search);
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      const data = await apiFetch<Paginated<AdminLesson>>(
        `/api/v1/admin/lessons/${suffix}`,
      );
      return {
        ...data,
        results: data.results.map((l) => ({
          ...l,
          video_file: absolutize(l.video_file),
        })),
      };
    },
    lesson: async (id: number) => {
      const data = await apiFetch<AdminLesson>(`/api/v1/admin/lessons/${id}/`);
      return { ...data, video_file: absolutize(data.video_file) };
    },
    createLesson: (form: FormData) =>
      apiFetch<AdminLesson>("/api/v1/admin/lessons/", {
        method: "POST",
        body: form,
      }),
    // updateLesson intentionally omitted for Phase 1 — edit UI is Phase 2.
    // Re-add when the /admin/lessons/[id]/edit form is built.
    deleteLesson: (id: number) =>
      apiFetch<void>(`/api/v1/admin/lessons/${id}/`, { method: "DELETE" }),

    courses: async (
      params: { subject?: number; grade?: number; quarter?: number } = {},
    ) => {
      const qs = new URLSearchParams();
      if (params.subject) qs.set("subject", String(params.subject));
      if (params.grade) qs.set("grade", String(params.grade));
      if (params.quarter) qs.set("quarter", String(params.quarter));
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      const data = await apiFetch<Paginated<AdminCourse>>(
        `/api/v1/admin/courses/${suffix}`,
      );
      return {
        ...data,
        results: data.results.map((c) => ({
          ...c,
          cover_image: absolutize(c.cover_image),
        })),
      };
    },
    course: async (id: number) => {
      const data = await apiFetch<AdminCourse>(
        `/api/v1/admin/courses/${id}/`,
      );
      return { ...data, cover_image: absolutize(data.cover_image) };
    },
    createCourse: (form: FormData) =>
      apiFetch<AdminCourse>("/api/v1/admin/courses/", {
        method: "POST",
        body: form,
      }),
    updateCourse: (id: number, form: FormData) =>
      apiFetch<AdminCourse>(`/api/v1/admin/courses/${id}/`, {
        method: "PATCH",
        body: form,
      }),
    deleteCourse: (id: number) =>
      apiFetch<void>(`/api/v1/admin/courses/${id}/`, { method: "DELETE" }),

    createModule: (courseId: number, body: { title: string }) =>
      apiFetch<AdminModule>(
        `/api/v1/admin/courses/${courseId}/modules/`,
        { method: "POST", body: JSON.stringify(body) },
      ),
    deleteModule: (moduleId: number) =>
      apiFetch<void>(`/api/v1/admin/modules/${moduleId}/`, {
        method: "DELETE",
      }),
    attachLesson: (moduleId: number, lessonId: number) =>
      apiFetch<AdminModuleLessonEntry>(
        `/api/v1/admin/modules/${moduleId}/lessons/`,
        { method: "POST", body: JSON.stringify({ lesson_id: lessonId }) },
      ),
    detachLesson: (moduleLessonId: number) =>
      apiFetch<void>(
        `/api/v1/admin/module-lessons/${moduleLessonId}/`,
        { method: "DELETE" },
      ),
  },

  // ---- Courses (teacher-facing) ----
  courses: async (
    params: { subject?: number; grade?: number; quarter?: number } = {},
  ) => {
    const qs = new URLSearchParams();
    if (params.subject) qs.set("subject", String(params.subject));
    if (params.grade) qs.set("grade", String(params.grade));
    if (params.quarter) qs.set("quarter", String(params.quarter));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    const data = await apiFetch<Paginated<Course>>(
      `/api/v1/courses/${suffix}`,
    );
    return {
      ...data,
      results: data.results.map((c) => ({
        ...c,
        cover_image: absolutize(c.cover_image),
      })),
    };
  },
  course: async (id: number) => {
    const data = await apiFetch<CourseDetail>(`/api/v1/courses/${id}/`);
    return { ...data, cover_image: absolutize(data.cover_image) };
  },
  lesson: async (id: number) => {
    const data = await apiFetch<Lesson>(`/api/v1/lessons/${id}/`);
    return { ...data, video_file: absolutize(data.video_file) };
  },
  toggleLessonComplete: (lessonId: number) =>
    apiFetch<{ is_completed: boolean } | { id: number; lesson: number; completed_at: string }>(
      `/api/v1/lessons/${lessonId}/complete/`,
      { method: "POST", body: "{}" },
    ),
};
