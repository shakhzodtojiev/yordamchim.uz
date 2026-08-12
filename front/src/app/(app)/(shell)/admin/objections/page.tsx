import Link from "next/link";

import { FadeUp } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { AdminObjectionsList } from "@/features/objections/admin-objections-list";
import { api } from "@/lib/api/endpoints";
import type { ObjectionStatus } from "@/types/api";

export const dynamic = "force-dynamic";

const TABS: Array<{ key: ObjectionStatus | "all"; label: string }> = [
  { key: "pending", label: "Ko'rib chiqilmoqda" },
  { key: "resolved", label: "Hal qilindi" },
  { key: "rejected", label: "Rad etilgan" },
  { key: "all", label: "Hammasi" },
];

export default async function AdminObjectionsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const active = (searchParams.status as ObjectionStatus | "all") ?? "pending";
  const items = await api.admin.objections({
    status: active === "all" ? undefined : active,
  });
  const allCount = (await api.admin.objections({ status: "pending" })).length;

  return (
    <div className="max-w-5xl space-y-6">
      <FadeUp>
        <header className="rounded-2xl border bg-soft-gradient p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            E'tirozlar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            O'qituvchilar yuborgan savol/javob bo'yicha e'tirozlarni shu yerda
            ko'rib chiqing.
            {allCount > 0 ? (
              <span className="ml-2 inline-flex items-center gap-1">
                <Badge variant="warning">{allCount} ko'rib chiqilmoqda</Badge>
              </span>
            ) : null}
          </p>
        </header>
      </FadeUp>

      <div className="flex flex-wrap gap-2 border-b pb-2">
        {TABS.map((t) => {
          const isActive = active === t.key;
          const href =
            t.key === "all"
              ? "/admin/objections?status=all"
              : `/admin/objections?status=${t.key}`;
          return (
            <Link
              key={t.key}
              href={href}
              className={`text-sm rounded-md px-3 py-1.5 transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <AdminObjectionsList items={items} />
    </div>
  );
}
