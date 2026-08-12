export type UserRole = "teacher" | "admin" | "superadmin";

export type User = {
  id: number;
  email: string;
  full_name: string;
  has_completed_onboarding: boolean;
  is_admin: boolean;
  is_superuser: boolean;
  /** True if either is_admin or is_superuser — gates the custom admin panel. */
  can_admin: boolean;
  role: UserRole;
};

export type AdminStats = {
  teachers: { total: number; onboarded: number; active_7d: number };
  presentations: { total: number; published: number; views_7d: number };
  tests: { attempts_total: number; attempts_7d: number; average_score: number };
  objections: { pending: number };
  top_presentations: Array<{
    id: number;
    title: string;
    view_count: number;
    subject: string;
    grade: string;
  }>;
};

export type ObjectionReason =
  | "wrong_answer"
  | "wrong_question"
  | "typo"
  | "unclear"
  | "other";

export type ObjectionStatus = "pending" | "resolved" | "rejected";

/** What teachers see on their own objection list. */
export type Objection = {
  id: number;
  question: number;
  question_text: string;
  attempt: number | null;
  reason: ObjectionReason;
  reason_label: string;
  body: string;
  status: ObjectionStatus;
  status_label: string;
  admin_note: string;
  created_at: string;
  resolved_at: string | null;
};

/** Admin row — adds user/pool context for triage. */
export type AdminObjection = Objection & {
  user: number;
  user_email: string;
  user_full_name: string;
  question_id: number;
  question_pool_id: number;
  question_pool_title: string;
  attempt_id: number | null;
};

export type ObjectionInput = {
  question_id: number;
  attempt_id?: number | null;
  reason: ObjectionReason;
  body?: string;
};

export type AdminTeacher = {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  has_completed_onboarding: boolean;
  role: UserRole;
  date_joined: string;
  last_login: string | null;
  subjects: Subject[];
  grades: Grade[];
  attempts_count: number;
  presentation_views_count: number;
};

export type Quarter = 1 | 2 | 3 | 4;

export type AdminPresentation = {
  id: number;
  title: string;
  description: string;
  subject: Subject;
  grade: Grade;
  quarter: Quarter | null;
  cover_image: string | null;
  /** Friendly filename of the attached pptx, or null. */
  pptx_filename: string | null;
  slide_count: number;
  view_count: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminSlide = {
  id: number;
  presentation: number;
  order: number;
  image: string;
  width: number | null;
  height: number | null;
};

export type TokenPair = {
  access: string;
  refresh: string;
};

export type AuthSuccess = {
  user: User;
  tokens: TokenPair;
};

export type Subject = { id: number; name: string; slug: string };
export type Grade = { id: number; name: string; level: number };

export type Preferences = {
  subjects: number[];
  grades: number[];
};

export type Presentation = {
  id: number;
  title: string;
  description: string;
  subject: Subject;
  grade: Grade;
  quarter: Quarter | null;
  cover_image: string | null;
  slide_count: number;
  view_count: number;
  created_at: string;
  // Marketplace. Official decks (is_official) are free; teacher decks carry a
  // price and must be owned (is_owned) to open.
  price: number;
  is_listed: boolean;
  is_official: boolean;
  is_owned: boolean;
  author_name: string | null;
};

export type Slide = {
  id: number;
  order: number;
  width: number | null;
  height: number | null;
  image_url: string;
  expires_at: number;
};

export type PresentationDetail = Presentation & {
  slides: Slide[];
  // A listed teacher deck the caller hasn't bought: metadata only, no slides.
  is_locked: boolean;
};

// ---- Wallet / marketplace ----

export type Wallet = { balance: number; updated_at: string };

export type WalletTxType =
  | "topup"
  | "generation_fee"
  | "purchase"
  | "sale_income"
  | "commission"
  | "withdrawal"
  | "adjustment";

export type WalletTransaction = {
  id: number;
  amount: number;
  balance_after: number;
  type: WalletTxType;
  type_display: string;
  presentation: number | null;
  presentation_title: string | null;
  note: string;
  created_at: string;
};

export type GenerationStatus = "pending" | "processing" | "done" | "failed";

export type GenerationJob = {
  id: number;
  topic: string;
  num_slides: number;
  quarter: Quarter | null;
  status: GenerationStatus;
  status_display: string;
  presentation: number | null;
  model_used: string;
  error: string;
  created_at: string;
  updated_at: string;
};

export type AdminWallet = {
  balance: number;
  transactions: WalletTransaction[];
};

// ---- Courses ----

export type LessonKind = "video" | "text" | "test";

export type Lesson = {
  id: number;
  title: string;
  description: string;
  kind: LessonKind;
  subject: Subject;
  grade: Grade;
  video_url: string;
  video_file: string | null;
  body: string;
  test: number | null;
  duration_seconds: number | null;
  is_completed: boolean;
};

export type LessonListItem = {
  id: number;
  title: string;
  kind: LessonKind;
  duration_seconds: number | null;
  is_completed: boolean;
};

export type CourseModule = {
  id: number;
  title: string;
  order: number;
  lessons: LessonListItem[];
};

export type Course = {
  id: number;
  title: string;
  description: string;
  subject: Subject;
  grade: Grade;
  quarter: Quarter | null;
  cover_image: string | null;
  lesson_count: number;
  completed_count: number;
  created_at: string;
};

export type CourseDetail = Course & {
  modules: CourseModule[];
};

// ---- Admin course types ----

export type AdminLesson = {
  id: number;
  title: string;
  description: string;
  kind: LessonKind;
  subject: Subject;
  grade: Grade;
  topic_pool_name: string | null;
  video_url: string;
  video_file: string | null;
  body: string;
  test: number | null;
  duration_seconds: number | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminModuleLessonEntry = {
  id: number;
  lesson: {
    id: number;
    title: string;
    kind: LessonKind;
    duration_seconds: number | null;
  };
  order: number;
};

export type AdminModule = {
  id: number;
  title: string;
  order: number;
  lessons: AdminModuleLessonEntry[];
};

export type AdminCourse = {
  id: number;
  title: string;
  description: string;
  subject: Subject;
  grade: Grade;
  quarter: Quarter | null;
  cover_image: string | null;
  is_published: boolean;
  modules: AdminModule[];
  lesson_count: number;
  created_at: string;
  updated_at: string;
};

export type PoolType = "oddiy" | "nazariy";
export type TestKind = "regular" | "mock";

export type Test = {
  id: number;
  title: string;
  description: string;
  /** Primary subject — first pool's subject, used for the main badge. */
  subject: Subject | null;
  /** All distinct subjects across the test's pools. */
  subjects: Subject[];
  pool_count: number;
  kind: TestKind;
  available_from: string | null;
  available_until: string | null;
  duration_seconds: number;
  question_count: number;
  questions_per_attempt: number;
  is_within_window: boolean;
  has_started: boolean;
  has_ended: boolean;
  created_at: string;
};

export type QuestionType = "single" | "multi" | "matching";
export type Difficulty = "easy" | "medium" | "hard";

export type Choice = {
  id: number;
  order: number;
  text: string;
  image_url: string | null;
};
/** Full pair (both sides) — only used in *results*, after submit, where
 *  revealing the correct mapping is fine. */
export type MatchPair = {
  id: number;
  order: number;
  left_text: string;
  left_image_url: string | null;
  right_text: string;
  right_image_url: string | null;
};

/** Left prompt of a matching question during the attempt — keyed by pair id,
 *  carries no right-side data (that would leak the answer). */
export type MatchLeft = {
  id: number;
  order: number;
  left_text: string;
  left_image_url: string | null;
};

/** Right option of a matching question during the attempt — identified by an
 *  opaque per-attempt token, not the pair id, so the client can't infer which
 *  left it belongs to. Submitted back verbatim. */
export type MatchOption = {
  token: string;
  right_text: string;
  right_image_url: string | null;
};

export type Question = {
  id: number;
  order: number;
  text: string;
  image_url: string | null;
  question_type: QuestionType;
  difficulty: Difficulty;
  choices: Choice[];
  pairs: MatchLeft[];
  options: MatchOption[];
  pool_id: number;
  pool_title: string;
  pool_type: PoolType;
};

export type AttemptStart = {
  id: number;
  test: Test;
  started_at: string;
  deadline_at: string;
  status: "in_progress" | "submitted" | "expired";
  questions: Question[];
};

/** Submission payload — one shape covers all three question types. Empty
 *  arrays mean "skipped". */
export type SubmitAnswer = {
  question_id: number;
  choice_ids?: number[];
  /** [left_pair_id, right_option_token] — the token comes from
   *  Question.options; the server resolves it back to a pair id. */
  matches?: Array<[number, string]>;
};

/** Choice payload exposed in attempt results — `is_correct` is OK here
 *  because the attempt has been submitted. */
export type ResultChoice = Choice & { is_correct: boolean };

export type AnswerResult = {
  question: number;
  question_type: QuestionType;
  question_text: string;
  question_image_url: string | null;
  choices: ResultChoice[];
  pairs: MatchPair[];
  selected_choice_ids: number[];
  /** [left_pair_id, resolved_right_pair_id] — right is null if the submitted
   *  token didn't resolve to a pair. */
  match_payload: Array<[number, number | null]>;
  correct_matches: Array<[number, number]>;
  is_correct: boolean;
  pool_id: number;
  pool_title: string;
  pool_type: PoolType;
};

export type AttemptResult = {
  id: number;
  test: Test;
  started_at: string;
  submitted_at: string | null;
  deadline_at: string;
  status: "in_progress" | "submitted" | "expired";
  correct_count: number;
  total_count: number;
  score: number;
  answers: AnswerResult[];
  /** Rank among submitted attempts on this test (1 = best). Null for
   *  in-progress attempts. */
  rank: number | null;
  rank_total: number | null;
};

export type AttemptHistoryItem = {
  id: number;
  test: Test;
  started_at: string;
  submitted_at: string | null;
  status: "in_progress" | "submitted" | "expired";
  score: number;
  correct_count: number;
  total_count: number;
};

export type Stats = {
  tests_taken: number;
  average_score: number;
};

export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

/** Compact pool block embedded inside an admin test's pools[] entry. */
export type AdminTestPool = {
  id: number;
  title: string;
  subject: Subject;
  pool_type: PoolType;
  question_count: number;
};

/** A row in a test's pools[] — links a pool to per-difficulty quotas. */
export type AdminTestPoolEntry = {
  id: number;
  pool: AdminTestPool;
  order: number;
  easy_count: number;
  medium_count: number;
  hard_count: number;
};

/** Write payload for a single pools[] entry — sent on create/update. */
export type AdminTestPoolInput = {
  pool_id: number;
  easy_count: number;
  medium_count: number;
  hard_count: number;
};

export type AdminTestListItem = {
  id: number;
  title: string;
  description: string;
  pools: AdminTestPoolEntry[];
  subjects: Subject[];
  kind: TestKind;
  available_from: string | null;
  available_until: string | null;
  duration_seconds: number;
  questions_per_attempt: number;
  is_published: boolean;
  created_at: string;
};

export type AdminChoiceInput = {
  id?: number;
  text: string;
  is_correct: boolean;
};

export type AdminChoice = AdminChoiceInput & {
  id: number;
  order: number;
  image_url: string | null;
};

export type AdminMatchPairInput = {
  id?: number;
  left_text: string;
  right_text: string;
};

export type AdminMatchPair = AdminMatchPairInput & {
  id: number;
  order: number;
  left_image_url: string | null;
  right_image_url: string | null;
};

export type AdminQuestion = {
  id: number;
  pool: number;
  order: number;
  text: string;
  image_url: string | null;
  question_type: QuestionType;
  difficulty: Difficulty;
  choices: AdminChoice[];
  pairs: AdminMatchPair[];
};

/** Pool list row — admin browses pools, then drills into one to manage
 *  questions. */
export type AdminPoolListItem = {
  id: number;
  title: string;
  description: string;
  subject: Subject;
  pool_type: PoolType;
  question_count: number;
  created_at: string;
};

export type AdminPool = AdminPoolListItem & {
  questions: AdminQuestion[];
};

/** Submission payload — JSON envelope sent as `data` field in multipart.
 *  Image uploads / clears travel as separate keyed parts. */
export type AdminQuestionPayload = {
  text: string;
  question_type: QuestionType;
  difficulty: Difficulty;
  choices?: AdminChoiceInput[];
  pairs?: AdminMatchPairInput[];
};

/** Per-position image action: either a freshly picked File, "clear" to drop
 *  the existing image, or "keep" to leave it alone (default). */
export type ImageAction =
  | { action: "keep" }
  | { action: "clear" }
  | { action: "set"; file: File };

/** Detail view used by the admin test edit page. Questions live on the
 *  pool — fetch them through the pool detail endpoint, not here. */
export type AdminTest = AdminTestListItem;
