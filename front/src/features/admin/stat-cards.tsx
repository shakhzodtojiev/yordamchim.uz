import {
  GraduationCap,
  PlaySquare,
  Target,
  Users,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { formatPercent } from "@/lib/utils";
import type { AdminStats } from "@/types/api";

export function AdminStatCards({ stats }: { stats: AdminStats }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Stat
        icon={Users}
        label="O'qituvchilar"
        value={stats.teachers.total.toLocaleString("uz-UZ")}
        hint={`${stats.teachers.active_7d} faol (7 kun)`}
      />
      <Stat
        icon={PlaySquare}
        label="Taqdimotlar"
        value={`${stats.presentations.published}/${stats.presentations.total}`}
        hint={`${stats.presentations.views_7d} ko'rishlar (7 kun)`}
      />
      <Stat
        icon={GraduationCap}
        label="Topshirilgan testlar"
        value={stats.tests.attempts_total.toLocaleString("uz-UZ")}
        hint={`${stats.tests.attempts_7d} (7 kun)`}
      />
      <Stat
        icon={Target}
        label="O'rtacha natija"
        value={formatPercent(stats.tests.average_score)}
        hint=" "
        accent="emerald"
      />
    </div>
  );
}

type StatProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
  accent?: "primary" | "emerald";
};

function Stat({ icon: Icon, label, value, hint, accent = "primary" }: StatProps) {
  const ring =
    accent === "emerald"
      ? "bg-emerald-500/10 text-emerald-600"
      : "bg-primary/10 text-primary";
  return (
    <Card>
      <CardContent className="p-5 flex items-start gap-4">
        <div className={`h-10 w-10 rounded-lg grid place-items-center ${ring}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold tabular-nums">{value}</div>
          <div className="text-xs text-muted-foreground truncate">{hint}</div>
        </div>
      </CardContent>
    </Card>
  );
}
