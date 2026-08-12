import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PresentationCard } from "@/features/presentations/presentation-card";
import { api } from "@/lib/api/endpoints";
import { ROUTES } from "@/lib/constants";
import type { Presentation } from "@/types/api";

export const dynamic = "force-dynamic";

function Section({
  title,
  subtitle,
  items,
  empty,
}: {
  title: string;
  subtitle: string;
  items: Presentation[];
  empty: string;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {items.length === 0 ? (
        <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
          {empty}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((p) => (
            <PresentationCard key={p.id} item={p} />
          ))}
        </div>
      )}
    </section>
  );
}

export default async function MyPresentationsPage() {
  const [mine, purchased] = await Promise.all([
    api.myPresentations(),
    api.purchasedPresentations(),
  ]);

  return (
    <div className="max-w-6xl space-y-8">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={ROUTES.PRESENTATIONS}>
            <ArrowLeft className="h-4 w-4" />
            Taqdimotlar
          </Link>
        </Button>
        <Button asChild>
          <Link href="/presentations/create">
            <Sparkles className="h-4 w-4" />
            Taqdimot yaratish
          </Link>
        </Button>
      </div>

      <Section
        title="Men yaratganlarim"
        subtitle="AI orqali generatsiya qilgan taqdimotlaringiz."
        items={mine.results}
        empty="Hali taqdimot yaratmagansiz."
      />

      <Section
        title="Sotib olganlarim"
        subtitle="Boshqa o'qituvchilardan xarid qilingan taqdimotlar."
        items={purchased.results}
        empty="Hali taqdimot sotib olmagansiz."
      />
    </div>
  );
}
