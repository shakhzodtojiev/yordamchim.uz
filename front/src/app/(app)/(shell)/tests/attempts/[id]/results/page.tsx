import Link from "next/link";
import { notFound } from "next/navigation";
import { Home } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { AnswerResult, AttemptResult } from "@/types/api";

export const dynamic = "force-dynamic";

export default async function AttemptResultsPage({
  params,
}: {
  params: { id: string };
}) {
  const attemptId = Number(params.id);
  if (!Number.isFinite(attemptId)) notFound();

  let attempt: AttemptResult;
  try {
    attempt = await api.attempt(attemptId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const score = Math.round(attempt.score);
  const ball = score;
  const maxBall = 100;
  const grade = scoreGrade(score);
  const pools = groupAnswersByPool(attempt.answers);

  return (
    <div className="max-w-3xl mx-auto space-y-5 sm:space-y-6 pb-6">
      <header className="text-center space-y-1">
        <div className="text-xs sm:text-sm text-muted-foreground line-clamp-1 px-4">
          {attempt.test.title}
        </div>
        <h1 className="text-xl sm:text-3xl font-bold tracking-tight">
          Test yakunlandi
        </h1>
      </header>

      <section className="grid grid-cols-4 gap-1.5 sm:gap-3 items-stretch">
        <ScoreRing score={score} grade={grade} />
        <StatBox value={ball} label="ball" />
        <StatBox value={maxBall} label="max" />
        <StatBox
          value={attempt.rank != null ? `#${attempt.rank}` : "—"}
          label={attempt.rank_total != null ? `/${attempt.rank_total}` : ""}
        />
      </section>

      <Legend />

      {pools.map((p, sectionIdx) => {
        const offset = pools
          .slice(0, sectionIdx)
          .reduce((acc, prev) => acc + prev.answers.length, 0);
        return (
          <PoolGrid
            key={p.id}
            title={p.title}
            shape={p.shape}
            startNumber={offset + 1}
            answers={p.answers}
          />
        );
      })}

      {attempt.rank != null && attempt.rank_total != null ? (
        <p className="text-center text-xs sm:text-sm text-muted-foreground">
          Guruhingizda{" "}
          <span className="font-semibold text-foreground">
            #{attempt.rank}
          </span>{" "}
          o'rinda ({attempt.rank_total} ichida)
        </p>
      ) : null}

      <Button asChild size="lg" className="w-full">
        <Link href={ROUTES.DASHBOARD}>
          <Home className="h-4 w-4" />
          Bosh sahifaga qaytish
        </Link>
      </Button>
    </div>
  );
}

/* ---------------- summary widgets -------------------------------------- */

function ScoreRing({ score, grade }: { score: number; grade: GradeLabel }) {
  // SVG uses a 96-unit coordinate system; CSS width/height does the actual
  // sizing so the ring scales cleanly from narrow phones (64px) to wide
  // viewports (96px) without separate render paths.
  const SVG_UNITS = 96;
  const stroke = 8;
  const r = (SVG_UNITS - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const dash = c * (1 - pct / 100);
  const color = grade === "good" ? "#10b981" : grade === "ok" ? "#f59e0b" : "#ef4444";
  return (
    <div className="rounded-2xl border bg-card p-2 sm:p-3 flex flex-col items-center justify-center gap-1">
      <div className="relative h-14 w-14 sm:h-24 sm:w-24">
        <svg
          viewBox={`0 0 ${SVG_UNITS} ${SVG_UNITS}`}
          className="absolute inset-0 -rotate-90 h-full w-full"
        >
          <circle
            cx={SVG_UNITS / 2}
            cy={SVG_UNITS / 2}
            r={r}
            stroke="currentColor"
            strokeOpacity={0.12}
            strokeWidth={stroke}
            fill="none"
            className="text-muted-foreground"
          />
          <circle
            cx={SVG_UNITS / 2}
            cy={SVG_UNITS / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={c}
            strokeDashoffset={dash}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span
            className="text-sm sm:text-xl font-bold tabular-nums"
            style={{ color }}
          >
            {score}%
          </span>
        </div>
      </div>
      <span
        className="text-[10px] sm:text-xs font-medium leading-none"
        style={{ color }}
      >
        {gradeLabel(grade)}
      </span>
    </div>
  );
}

function StatBox({
  value,
  label,
}: {
  value: string | number;
  label: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-2 sm:p-3 flex flex-col items-center justify-center gap-0.5 sm:gap-1 min-w-0">
      <span className="text-lg sm:text-2xl font-bold tracking-tight tabular-nums truncate max-w-full">
        {value}
      </span>
      <span className="text-[10px] sm:text-xs text-muted-foreground truncate max-w-full">
        {label}
      </span>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-3 sm:gap-4 text-[11px] sm:text-xs text-muted-foreground flex-wrap">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-sm border-2 border-emerald-500 bg-emerald-100 shrink-0" />
        To'g'ri javoblar
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-sm border-2 border-dashed border-red-400 bg-red-100 shrink-0" />
        Noto'g'ri javoblar
      </span>
    </div>
  );
}

/* ---------------- pool grid -------------------------------------------- */

type PoolShape = "square" | "circle";

type PoolGroup = {
  id: number;
  title: string;
  shape: PoolShape;
  answers: AnswerResult[];
};

function groupAnswersByPool(answers: AnswerResult[]): PoolGroup[] {
  // Preserve the order they were materialized in (backend assigns per-pool
  // blocks in TestPool.order). Map keeps first-insertion order.
  const map = new Map<number, PoolGroup>();
  for (const a of answers) {
    const existing = map.get(a.pool_id);
    if (existing) {
      existing.answers.push(a);
      continue;
    }
    map.set(a.pool_id, {
      id: a.pool_id,
      title: a.pool_title,
      shape: a.pool_type === "nazariy" ? "circle" : "square",
      answers: [a],
    });
  }
  return Array.from(map.values());
}

function PoolGrid({
  title,
  shape,
  startNumber,
  answers,
}: {
  title: string;
  shape: PoolShape;
  startNumber: number;
  answers: AnswerResult[];
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {/* Column counts grow with the viewport so tiles stay tappable on
          narrow phones (~60px at 360px) and don't look lonely on desktop. */}
      <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-10 gap-1.5 sm:gap-2">
        {answers.map((a, i) => (
          <Tile
            key={`${a.question}-${i}`}
            number={startNumber + i}
            correct={a.is_correct}
            shape={shape}
          />
        ))}
      </div>
    </section>
  );
}

function Tile({
  number,
  correct,
  shape,
}: {
  number: number;
  correct: boolean;
  shape: PoolShape;
}) {
  return (
    <div
      className={cn(
        "aspect-square grid place-items-center text-[11px] sm:text-xs font-semibold border-2 tabular-nums",
        shape === "circle" ? "rounded-full" : "rounded-md",
        correct
          ? "border-emerald-500 bg-emerald-100 text-emerald-800"
          : "border-dashed border-red-400 bg-red-100 text-red-700",
      )}
      aria-label={`Savol ${number}: ${correct ? "to'g'ri" : "noto'g'ri"}`}
    >
      {number}
    </div>
  );
}

/* ---------------- grade ------------------------------------------------- */

type GradeLabel = "good" | "ok" | "bad";

function scoreGrade(score: number): GradeLabel {
  if (score >= 60) return "good";
  if (score >= 40) return "ok";
  return "bad";
}

function gradeLabel(g: GradeLabel): string {
  if (g === "good") return "Yaxshi";
  if (g === "ok") return "Qoniqarli";
  return "Yomon";
}
