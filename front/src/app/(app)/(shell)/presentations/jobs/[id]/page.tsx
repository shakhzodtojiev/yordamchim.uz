import { notFound } from "next/navigation";

import { JobStatus } from "@/features/presentations/job-status";
import { ApiError } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";

export const dynamic = "force-dynamic";

export default async function GenerationJobPage({
  params,
}: {
  params: { id: string };
}) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();

  let job;
  try {
    job = await api.generationJob(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  return (
    <div className="max-w-xl mx-auto py-8">
      <JobStatus initial={job} />
    </div>
  );
}
