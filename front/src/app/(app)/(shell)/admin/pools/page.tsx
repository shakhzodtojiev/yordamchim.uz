import Link from "next/link";
import { Library, PlusCircle } from "lucide-react";

import { FadeUp, Stagger, StaggerItem } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api/endpoints";

export const dynamic = "force-dynamic";

const POOL_TYPE_LABEL = {
  oddiy: "Oddiy",
  nazariy: "Nazariy",
} as const;

export default async function AdminPoolsPage() {
  const data = await api.admin.pools();

  return (
    <div className="max-w-6xl space-y-6">
      <FadeUp>
        <div className="flex items-end justify-between flex-wrap gap-3 rounded-2xl bg-soft-gradient p-6 sm:p-8 border">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Mavzulashtirilgan to'plamlar
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Jami: {data.count}. Har to'plamga savollar qo'shasiz, keyin shu
              to'plamdan testlar tuzasiz.
            </p>
          </div>
          <Button asChild>
            <Link href="/admin/pools/new">
              <PlusCircle className="h-4 w-4" />
              Yangi to'plam
            </Link>
          </Button>
        </div>
      </FadeUp>

      {data.results.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Hali to'plam yo'q. "Yangi to'plam" tugmasi orqali boshlang.
          </CardContent>
        </Card>
      ) : (
        <Stagger className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {data.results.map((p) => (
            <StaggerItem key={p.id}>
            <Link href={`/admin/pools/${p.id}`} className="block">
              <Card interactive className="h-full">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <Library className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="font-medium leading-tight">{p.title}</div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary">{p.subject.name}</Badge>
                    <Badge variant="outline">
                      {POOL_TYPE_LABEL[p.pool_type]}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground border-t pt-2">
                    {p.question_count} savol
                  </div>
                </CardContent>
              </Card>
            </Link>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
