import { GraduationCap, Target } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { formatPercent } from "@/lib/utils";
import type { Stats } from "@/types/api";

export function StatsCards({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Card>
        <CardContent className="p-5 flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center">
            <GraduationCap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Topshirilgan testlar</div>
            <div className="text-2xl font-semibold">{stats.tests_taken}</div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5 flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 grid place-items-center">
            <Target className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <div className="text-sm text-muted-foreground">O'rtacha natija</div>
            <div className="text-2xl font-semibold">
              {formatPercent(stats.average_score)}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
