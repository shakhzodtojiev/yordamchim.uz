"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  CheckCircle2,
  Flag,
  ListChecks,
  Loader2,
  Timer,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MathText } from "@/components/ui/math-text";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { ObjectionTrigger } from "@/features/objections/objection-modal";
import { cn, deadlineToSeconds, formatTime } from "@/lib/utils";
import type {
  AttemptStart,
  Difficulty,
  Question,
  SubmitAnswer,
} from "@/types/api";

import { submitAttemptAction } from "./actions";

type Props = { attempt: AttemptStart };

/** Per-question answer state. choice_ids covers single (length 0..1) and
 *  multi (length 0..N). matches is for matching: { leftPairId: optionToken }
 *  where the token is the opaque right-option id from Question.options. */
type AnswerState = {
  choice_ids: number[];
  matches: Record<number, string>;
};

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Oson",
  medium: "O'rta",
  hard: "Qiyin",
};

/** Stable shuffle seeded by the question id so the right column doesn't
 *  re-jumble on every re-render. */
function shuffleByQuestionId<T extends { id: number }>(
  items: T[],
  questionId: number,
): T[] {
  const arr = [...items];
  let seed = questionId * 9301 + 49297;
  for (let i = arr.length - 1; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280;
    const j = Math.floor((seed / 233280) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function emptyAnswer(): AnswerState {
  return { choice_ids: [], matches: {} };
}

function isAnswered(state: AnswerState): boolean {
  return state.choice_ids.length > 0 || Object.keys(state.matches).length > 0;
}

type PoolGroup = {
  id: number;
  title: string;
  shape: "square" | "circle";
  // (question, 0-based-index-in-attempt) tuples — index gives the tile number.
  items: Array<{ q: Question; idx: number }>;
};

function groupByPool(questions: Question[]): PoolGroup[] {
  const map = new Map<number, PoolGroup>();
  questions.forEach((q, idx) => {
    const existing = map.get(q.pool_id);
    if (existing) {
      existing.items.push({ q, idx });
      return;
    }
    map.set(q.pool_id, {
      id: q.pool_id,
      title: q.pool_title,
      shape: q.pool_type === "nazariy" ? "circle" : "square",
      items: [{ q, idx }],
    });
  });
  return Array.from(map.values());
}

export function TestRunner({ attempt }: Props) {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, AnswerState>>({});
  // Start unset so server-rendered HTML matches client hydration — we
  // can't seed from Date.now() inside the initial render or the two
  // computations land seconds apart and React tears down the boundary.
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [submittedOnce, setSubmittedOnce] = useState(false);
  const [autoSubmitAttempted, setAutoSubmitAttempted] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const questions = attempt.questions;
  const total = questions.length;
  const question: Question | undefined = questions[current];
  const answeredCount = Object.values(answers).filter(isAnswered).length;
  const pools = useMemo(() => groupByPool(questions), [questions]);

  useEffect(() => {
    // Seed the real remaining-seconds value after hydration, then tick
    // every second. Recomputing from the deadline on each tick (instead
    // of just decrementing) keeps the timer correct after tab throttle /
    // device sleep.
    setSecondsLeft(deadlineToSeconds(attempt.deadline_at));
    const id = setInterval(() => {
      setSecondsLeft(deadlineToSeconds(attempt.deadline_at));
    }, 1000);
    return () => clearInterval(id);
  }, [attempt.deadline_at]);

  const buildPayload = (): SubmitAnswer[] => {
    const payload: SubmitAnswer[] = [];
    for (const q of questions) {
      const a = answers[q.id];
      if (!a || !isAnswered(a)) continue;
      if (q.question_type === "matching") {
        const matches = Object.entries(a.matches).map(
          ([left, token]) => [Number(left), token] as [number, string],
        );
        payload.push({ question_id: q.id, matches });
      } else {
        payload.push({ question_id: q.id, choice_ids: a.choice_ids });
      }
    }
    return payload;
  };

  const submit = (auto = false) => {
    if (submittedOnce) return;
    setSubmittedOnce(true);
    startTransition(async () => {
      try {
        const result = await submitAttemptAction(attempt.id, buildPayload());
        if (result.ok === false) {
          toast.error(result.error);
          setSubmittedOnce(false);
          return;
        }
        if (auto) toast.message("Vaqt tugadi — javoblar yuborildi.");
        router.push(`/tests/attempts/${result.attemptId}/results`);
      } catch {
        // Network/transport failure — don't leave the button permanently
        // disabled, or the user can never resubmit without losing answers.
        toast.error("Javoblarni yuborib bo'lmadi. Qayta urinib ko'ring.");
        setSubmittedOnce(false);
      }
    });
  };

  useEffect(() => {
    // Null until the post-hydration effect seeds it — skip until then.
    if (secondsLeft != null && secondsLeft <= 0 && !autoSubmitAttempted && !submittedOnce) {
      setAutoSubmitAttempted(true);
      submit(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, autoSubmitAttempted, submittedOnce]);

  if (!question) return null;

  const setAnswer = (qid: number, patch: Partial<AnswerState>) => {
    setAnswers((prev) => ({
      ...prev,
      [qid]: { ...emptyAnswer(), ...prev[qid], ...patch },
    }));
  };

  const toggleSingleChoice = (qid: number, choiceId: number) => {
    setAnswer(qid, { choice_ids: [choiceId] });
  };

  const toggleMultiChoice = (qid: number, choiceId: number) => {
    const prev = answers[qid]?.choice_ids ?? [];
    const next = prev.includes(choiceId)
      ? prev.filter((c) => c !== choiceId)
      : [...prev, choiceId];
    setAnswer(qid, { choice_ids: next });
  };

  const setMatch = (qid: number, leftPairId: number, token: string) => {
    const prev = answers[qid]?.matches ?? {};
    const next = { ...prev };
    // Each right option can only be used once — clear any previous left that
    // had picked this token.
    for (const key of Object.keys(next)) {
      if (next[Number(key)] === token) delete next[Number(key)];
    }
    if (!token) {
      delete next[leftPairId];
    } else {
      next[leftPairId] = token;
    }
    setAnswer(qid, { matches: next });
  };

  const jumpTo = (idx: number) => {
    setCurrent(idx);
    setNavOpen(false);
  };

  // All "Yakunlash" buttons open a confirmation modal instead of submitting
  // straight away — users have asked twice now after accidentally
  // submitting half-finished attempts.
  const onYakunlash = () => {
    setConfirmOpen(true);
  };

  const confirmAndSubmit = () => {
    setConfirmOpen(false);
    submit(false);
  };

  const navPanel = (
    <NavPanel
      testTitle={attempt.test.title}
      pools={pools}
      currentIdx={current}
      answers={answers}
      questions={questions}
      answeredCount={answeredCount}
      total={total}
      onPickQuestion={jumpTo}
      onCalculator={() => setCalcOpen((v) => !v)}
      onYakunlash={onYakunlash}
      isSubmitting={isPending}
    />
  );

  return (
    <div className="max-w-6xl mx-auto">
      {/* Mobile sticky bar: timer + Savollar + Yakunlash. */}
      <div className="lg:hidden sticky top-0 z-20 -mx-4 px-4 py-2 bg-background/95 backdrop-blur border-b mb-3 flex items-center gap-2">
        <TimerChip seconds={secondsLeft} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => setCalcOpen((v) => !v)}
        >
          <Calculator className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setNavOpen(true)}
          aria-label="Savollar ro'yxati"
        >
          <ListChecks className="h-4 w-4" />
          <span className="tabular-nums">
            {answeredCount}/{total}
          </span>
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onYakunlash}
          disabled={isPending || submittedOnce}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (
            <>
              <Flag className="h-4 w-4" />
              Yakunlash
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
        {/* Left — question */}
        <div className="space-y-4 min-w-0">
          {/* Desktop top row: title + timer */}
          <div className="hidden lg:flex items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground truncate">
              {attempt.test.title}
            </div>
            <TimerChip seconds={secondsLeft} />
          </div>

          <Card>
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">
                    {DIFFICULTY_LABEL[question.difficulty]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Savol {current + 1} / {total}
                  </span>
                </div>
                <ObjectionTrigger
                  questionId={question.id}
                  attemptId={attempt.id}
                  compact
                />
              </div>
              {question.text ? (
                <MathText
                  as="div"
                  text={question.text}
                  className="text-base font-medium leading-relaxed"
                />
              ) : null}
              {question.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={question.image_url}
                  alt=""
                  className="rounded-md border max-h-80 w-auto"
                />
              ) : null}

              {question.question_type === "single" ? (
                <SingleChoiceBody
                  question={question}
                  selected={answers[question.id]?.choice_ids[0] ?? null}
                  onPick={(cid) => toggleSingleChoice(question.id, cid)}
                />
              ) : null}

              {question.question_type === "multi" ? (
                <MultiChoiceBody
                  question={question}
                  selected={answers[question.id]?.choice_ids ?? []}
                  onToggle={(cid) => toggleMultiChoice(question.id, cid)}
                />
              ) : null}

              {question.question_type === "matching" ? (
                <MatchingBody
                  question={question}
                  matches={answers[question.id]?.matches ?? {}}
                  onPick={(leftId, token) =>
                    setMatch(question.id, leftId, token)
                  }
                />
              ) : null}
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              disabled={current === 0}
              onClick={() => setCurrent((c) => Math.max(0, c - 1))}
            >
              <ArrowLeft className="h-4 w-4" />
              Ortga
            </Button>
            {current < total - 1 ? (
              <Button onClick={() => setCurrent((c) => c + 1)}>
                Keyingi
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={onYakunlash} disabled={isPending || submittedOnce}>
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Flag className="h-4 w-4" />
                    Yakunlash
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Right — nav panel (desktop only — mobile uses Sheet). */}
        <aside className="hidden lg:block lg:sticky lg:top-4 self-start max-h-[calc(100vh-2rem)] overflow-auto">
          {navPanel}
        </aside>
      </div>

      {/* Mobile slide-up sheet for the nav grid. */}
      {navOpen ? (
        <NavSheet onClose={() => setNavOpen(false)}>{navPanel}</NavSheet>
      ) : null}

      {/* Inline calculator popover — bottom-right floater, both viewports. */}
      {calcOpen ? <CalculatorPanel onClose={() => setCalcOpen(false)} /> : null}

      {/* Confirm-submit modal — gates every Yakunlash button. */}
      {confirmOpen ? (
        <ConfirmSubmitDialog
          answered={answeredCount}
          total={total}
          isSubmitting={isPending}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={confirmAndSubmit}
        />
      ) : null}
    </div>
  );
}

/* ============================================================
 *  Navigation panel
 * ============================================================ */

function NavPanel({
  testTitle,
  pools,
  currentIdx,
  questions,
  answers,
  answeredCount,
  total,
  onPickQuestion,
  onCalculator,
  onYakunlash,
  isSubmitting,
}: {
  testTitle: string;
  pools: PoolGroup[];
  currentIdx: number;
  questions: Question[];
  answers: Record<number, AnswerState>;
  answeredCount: number;
  total: number;
  onPickQuestion: (idx: number) => void;
  onCalculator: () => void;
  onYakunlash: () => void;
  isSubmitting: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={onCalculator}
          >
            <Calculator className="h-4 w-4" />
            Kalkulyator
          </Button>
          <Button
            type="button"
            size="sm"
            className="flex-1"
            onClick={onYakunlash}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Flag className="h-4 w-4" />
                Yakunlash
              </>
            )}
          </Button>
        </div>

        <div>
          <div className="text-sm font-semibold leading-tight">{testTitle}</div>
        </div>

        <div className="space-y-4">
          {pools.map((p) => (
            <div key={p.id} className="space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                {p.title}
              </div>
              <div className="grid grid-cols-5 gap-2">
                {p.items.map(({ q, idx }) => {
                  const ans = answers[q.id];
                  const answered = ans ? isAnswered(ans) : false;
                  const active = idx === currentIdx;
                  return (
                    <NavTile
                      key={q.id}
                      number={idx + 1}
                      shape={p.shape}
                      active={active}
                      answered={answered}
                      onClick={() => onPickQuestion(idx)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="text-center text-xs text-muted-foreground pt-2 border-t">
          <span className="font-semibold text-foreground tabular-nums">
            {answeredCount}/{total}
          </span>{" "}
          javob berildi
        </div>
      </CardContent>
    </Card>
  );
}

function NavTile({
  number,
  shape,
  active,
  answered,
  onClick,
}: {
  number: number;
  shape: "square" | "circle";
  active: boolean;
  answered: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "aspect-square grid place-items-center text-sm font-semibold transition-colors",
        shape === "circle" ? "rounded-full" : "rounded-lg",
        "border-2",
        active
          ? "bg-foreground text-background border-foreground"
          : answered
            ? "bg-primary/10 text-foreground border-primary/40 hover:bg-primary/15"
            : "bg-card text-foreground/70 border-border hover:bg-accent",
      )}
      aria-current={active ? "true" : undefined}
      aria-label={`Savol ${number}${answered ? " — javob berilgan" : ""}`}
    >
      {number}
    </button>
  );
}

function NavSheet({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  // Body scroll lock + Esc-to-close, same UX as the bottom-nav More sheet.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Portal out of the in-page tree — the shell's PageTransition wrapper
  // sits in `transform: translateY(0)` after its mount animation, and CSS
  // makes that wrapper a new containing block for any nested `fixed`
  // element. Rendering onto document.body bypasses that.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end animate-fade-up"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" />
      <div className="relative bg-card border-t rounded-t-2xl shadow-lg p-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] mx-auto w-full max-w-md max-h-[85vh] overflow-auto">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-sm font-semibold">Savollar ro'yxati</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="grid place-items-center h-8 w-8 rounded-full hover:bg-accent text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/* ============================================================
 *  Confirm-submit dialog
 * ============================================================ */

function ConfirmSubmitDialog({
  answered,
  total,
  isSubmitting,
  onCancel,
  onConfirm,
}: {
  answered: number;
  total: number;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onCancel]);

  const unanswered = Math.max(0, total - answered);

  // Portal — see NavSheet's note for why.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center p-4 animate-fade-up"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" />
      <div className="relative bg-card border rounded-2xl shadow-lg w-full max-w-sm p-5 space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Testni yakunlamoqchimisiz?</h2>
          <p className="text-sm text-muted-foreground">
            Yakunlangandan keyin javoblarni o'zgartirib bo'lmaydi.
          </p>
        </div>

        <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Javob berilgan</span>
            <span className="font-semibold tabular-nums">
              {answered} / {total}
            </span>
          </div>
          {unanswered > 0 ? (
            <div className="text-xs text-destructive">
              {unanswered} ta savol javobsiz qoldi — bo'sh qoldirsangiz, ular
              noto'g'ri deb hisoblanadi.
            </div>
          ) : null}
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Yo'q, davom etish
          </Button>
          <Button onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Flag className="h-4 w-4" />
                Ha, yakunlash
              </>
            )}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ============================================================
 *  Timer chip
 * ============================================================ */

function TimerChip({ seconds }: { seconds: number | null }) {
  // Null = pre-hydration placeholder. Render the same neutral text the
  // server emitted so React's hydration check passes.
  const display = seconds == null ? "--:--" : formatTime(Math.max(0, seconds));
  const low = seconds != null && seconds <= 60;
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold tabular-nums",
        low
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-border bg-card",
      )}
      aria-live="polite"
    >
      <Timer className="h-4 w-4" />
      {display}
    </div>
  );
}

/* ============================================================
 *  Minimal calculator
 * ============================================================ */

const CALC_ALLOWED = /^[\d\s+\-*/().%]+$/;

function evalExpr(expr: string): string {
  const trimmed = expr.trim();
  if (!trimmed) return "";
  if (!CALC_ALLOWED.test(trimmed)) return "Xato";
  try {
    // eslint-disable-next-line no-new-func
    const v = Function(`"use strict"; return (${trimmed});`)();
    if (typeof v !== "number" || !Number.isFinite(v)) return "Xato";
    return String(Math.round(v * 1e8) / 1e8);
  } catch {
    return "Xato";
  }
}

function CalculatorPanel({ onClose }: { onClose: () => void }) {
  const [expr, setExpr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const result = evalExpr(expr);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const press = (s: string) => setExpr((prev) => prev + s);
  const clear = () => setExpr("");
  const back = () => setExpr((prev) => prev.slice(0, -1));
  const equals = () => setExpr(result === "Xato" ? expr : result);

  const KEYS = [
    ["7", "8", "9", "/"],
    ["4", "5", "6", "*"],
    ["1", "2", "3", "-"],
    ["0", ".", "(", "+"],
  ] as const;

  // Portal — see NavSheet's note for why.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed bottom-4 right-4 z-40 w-64 rounded-xl border bg-card shadow-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-muted-foreground">
          Kalkulyator
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Yopish"
          className="grid place-items-center h-6 w-6 rounded-full hover:bg-accent text-muted-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <input
        ref={inputRef}
        value={expr}
        onChange={(e) => setExpr(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            equals();
          }
        }}
        className="w-full rounded-md border bg-background px-2 py-1.5 text-right text-base font-mono tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        placeholder="0"
      />
      <div className="text-right text-xs text-muted-foreground tabular-nums min-h-4">
        {expr ? `= ${result}` : ""}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {KEYS.flat().map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            className="rounded-md border bg-background py-1.5 text-sm hover:bg-accent"
          >
            {k}
          </button>
        ))}
        <button
          type="button"
          onClick={clear}
          className="col-span-2 rounded-md border bg-background py-1.5 text-sm hover:bg-accent"
        >
          C
        </button>
        <button
          type="button"
          onClick={back}
          className="rounded-md border bg-background py-1.5 text-sm hover:bg-accent"
        >
          ←
        </button>
        <button
          type="button"
          onClick={equals}
          className="rounded-md bg-primary text-primary-foreground py-1.5 text-sm hover:bg-primary/90"
        >
          =
        </button>
      </div>
    </div>,
    document.body,
  );
}

/* ============================================================
 *  Question body renderers (unchanged from previous version)
 * ============================================================ */

function SingleChoiceBody({
  question,
  selected,
  onPick,
}: {
  question: Question;
  selected: number | null;
  onPick: (choiceId: number) => void;
}) {
  // Seed shuffling by question.id so the order is stable across re-renders
  // and back-navigation, but no longer leaks the seed-data convention of
  // "first choice = correct answer".
  const choices = useMemo(
    () => shuffleByQuestionId(question.choices, question.id),
    [question.choices, question.id],
  );
  return (
    <div className="space-y-2">
      {choices.map((choice, i) => {
        const isSelected = selected === choice.id;
        return (
          <button
            key={choice.id}
            type="button"
            onClick={() => onPick(choice.id)}
            className={`w-full text-left rounded-md border px-4 py-3 text-sm transition-colors hover:bg-accent flex items-center gap-3 ${
              isSelected ? "border-primary bg-primary/5" : ""
            }`}
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold shrink-0">
              {String.fromCharCode(65 + i)}
            </span>
            {choice.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={choice.image_url}
                alt=""
                className="h-16 w-16 rounded border object-cover shrink-0"
              />
            ) : null}
            {choice.text ? (
              <MathText as="span" text={choice.text} className="flex-1" />
            ) : null}
            {isSelected ? (
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function MultiChoiceBody({
  question,
  selected,
  onToggle,
}: {
  question: Question;
  selected: number[];
  onToggle: (choiceId: number) => void;
}) {
  // See SingleChoiceBody — same reason for the stable shuffle.
  const choices = useMemo(
    () => shuffleByQuestionId(question.choices, question.id),
    [question.choices, question.id],
  );
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Bir nechta to'g'ri javob bo'lishi mumkin — barchasini tanlang.
      </p>
      {choices.map((choice, i) => {
        const isSelected = selected.includes(choice.id);
        return (
          <button
            key={choice.id}
            type="button"
            onClick={() => onToggle(choice.id)}
            className={`w-full text-left rounded-md border px-4 py-3 text-sm transition-colors hover:bg-accent flex items-center gap-3 ${
              isSelected ? "border-primary bg-primary/5" : ""
            }`}
          >
            <span
              className={`inline-flex h-5 w-5 items-center justify-center rounded border shrink-0 ${
                isSelected ? "border-primary bg-primary text-primary-foreground" : ""
              }`}
            >
              {isSelected ? "✓" : ""}
            </span>
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold shrink-0">
              {String.fromCharCode(65 + i)}
            </span>
            {choice.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={choice.image_url}
                alt=""
                className="h-16 w-16 rounded border object-cover shrink-0"
              />
            ) : null}
            {choice.text ? (
              <MathText as="span" text={choice.text} className="flex-1" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function MatchingBody({
  question,
  matches,
  onPick,
}: {
  question: Question;
  matches: Record<number, string>;
  onPick: (leftPairId: number, token: string) => void;
}) {
  // The right column (question.options) is already shuffled server-side and
  // keyed by opaque tokens — no client-side shuffle, and the correct pairing
  // never reaches the browser.
  const rightOptions = question.options;
  const usedTokens = new Set(Object.values(matches));
  const anyRightImages = rightOptions.some((o) => o.right_image_url);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Har bir chap tomondagi qatorga to'g'ri keladigan o'ng tomonni tanlang.
      </p>
      <div className="space-y-2">
        {question.pairs.map((pair) => {
          const chosenToken = matches[pair.id] ?? null;
          return (
            <div
              key={pair.id}
              className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 sm:gap-3 items-center rounded-md border p-3"
            >
              <SidePreview
                text={pair.left_text}
                imageUrl={pair.left_image_url}
              />
              <span className="hidden sm:inline text-muted-foreground">→</span>
              {anyRightImages ? (
                <RightImagePicker
                  options={rightOptions}
                  chosenToken={chosenToken}
                  usedTokens={usedTokens}
                  onPick={(token) => onPick(pair.id, token)}
                />
              ) : (
                <select
                  value={chosenToken ?? ""}
                  onChange={(e) => onPick(pair.id, e.target.value)}
                  className="flex h-10 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">— tanlang —</option>
                  {rightOptions.map((opt) => {
                    const isUsedElsewhere =
                      usedTokens.has(opt.token) && chosenToken !== opt.token;
                    return (
                      <option
                        key={opt.token}
                        value={opt.token}
                        disabled={isUsedElsewhere}
                      >
                        {opt.right_text}
                        {isUsedElsewhere ? " (band)" : ""}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SidePreview({
  text,
  imageUrl,
}: {
  text: string;
  imageUrl: string | null;
}) {
  return (
    <div className="flex items-center gap-2">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className="h-16 w-16 rounded border object-cover shrink-0"
        />
      ) : null}
      {text ? (
        <MathText as="span" text={text} className="text-sm font-medium" />
      ) : null}
    </div>
  );
}

function RightImagePicker({
  options,
  chosenToken,
  usedTokens,
  onPick,
}: {
  options: {
    token: string;
    right_text: string;
    right_image_url: string | null;
  }[];
  chosenToken: string | null;
  usedTokens: Set<string>;
  onPick: (token: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((opt) => {
        const isChosen = chosenToken === opt.token;
        const isUsedElsewhere = usedTokens.has(opt.token) && !isChosen;
        return (
          <button
            key={opt.token}
            type="button"
            disabled={isUsedElsewhere}
            onClick={() => onPick(isChosen ? "" : opt.token)}
            className={`rounded-md border p-1 text-xs transition-colors ${
              isChosen ? "border-primary bg-primary/5" : ""
            } ${isUsedElsewhere ? "opacity-40 cursor-not-allowed" : "hover:bg-accent"}`}
          >
            {opt.right_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={opt.right_image_url}
                alt=""
                className="h-16 w-full rounded object-cover"
              />
            ) : null}
            {opt.right_text ? (
              <MathText
                as="div"
                text={opt.right_text}
                className="mt-1 truncate"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
