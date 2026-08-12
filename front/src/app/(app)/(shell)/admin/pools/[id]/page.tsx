import { notFound } from "next/navigation";

import { AdminPoolDetail } from "@/features/admin/pool-detail";
import { ApiError } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";

export const dynamic = "force-dynamic";

export default async function PoolDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();

  let pool;
  try {
    pool = await api.admin.pool(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const subjects = await api.subjects();
  return <AdminPoolDetail pool={pool} subjects={subjects} />;
}
