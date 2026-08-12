import Link from "next/link";
import { Clock, ListChecks } from "lucide-react";

import { Stagger, StaggerItem } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { AdminTestListItem } from "@/types/api";

const KIND_LABEL = {
  regular: "Oddiy",
  mock: "Mock",
} as const;

function formatRange(from: string | null, until: string | null): string | null {
  if (!from || !until) return null;
  return `${new Date(from).toLocaleString("uz-UZ")} — ${new Date(until).toLocaleString("uz-UZ")}`;
}

export function AdminTestsList({ tests }: { tests: AdminTestListItem[] }) {
  if (tests.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Hali testlar yo'q. "Yangi test" tugmasi orqali boshlang.
        </CardContent>
      </Card>
    );
  }

  return (
    <Stagger className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {tests.map((t) => {
        const window = formatRange(t.available_from, t.available_until);
        return (
          <StaggerItem key={t.id}>
          <Link href={`/tests/${t.id}`} className="block">
            <Card interactive className="h-full">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium leading-tight">{t.title}</div>
                  {t.is_published ? (
                    <Badge variant="success">Chop etilgan</Badge>
                  ) : (
                    <Badge variant="outline">Qoralama</Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {t.subjects.map((s) => (
                    <Badge key={s.id} variant="secondary">
                      {s.name}
                    </Badge>
                  ))}
                  <Badge
                    variant={t.kind === "mock" ? "destructive" : "outline"}
                  >
                    {KIND_LABEL[t.kind]}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {t.pools.length} ta to'plam ·{" "}
                  {t.pools
                    .map((tp) => tp.pool.title)
                    .slice(0, 2)
                    .join(", ")}
                  {t.pools.length > 2 ? "..." : ""}
                </div>
                {window ? (
                  <div className="text-xs text-muted-foreground">{window}</div>
                ) : null}
                <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
                  <span className="inline-flex items-center gap-1">
                    <ListChecks className="h-3.5 w-3.5" />
                    {t.questions_per_attempt} savol/urinish
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {Math.round(t.duration_seconds / 60)} daqiqa
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
          </StaggerItem>
        );
      })}
    </Stagger>
  );
}
