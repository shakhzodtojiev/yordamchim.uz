import { notFound, redirect } from "next/navigation";

import { TestRunner } from "@/features/tests/test-runner";
import { ApiError } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";

export const dynamic = "force-dynamic";

export default async function RunTestPage({
  params,
}: {
  params: { id: string };
}) {
  const testId = Number(params.id);
  if (!Number.isFinite(testId)) notFound();

  let attempt;
  try {
    // Read-only — the attempt is started by the form action, not here, so a
    // bookmarked/prefetched GET never mutates. 404 = no live attempt.
    attempt = await api.currentAttempt(testId);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
      redirect(`/tests/${testId}`);
    }
    throw error;
  }

  if (attempt.status !== "in_progress") {
    redirect(`/tests/attempts/${attempt.id}/results`);
  }

  return (
    <div className="py-2">
      <TestRunner attempt={attempt} />
    </div>
  );
}
