import Link from "next/link";
import {
  Eye,
  Flag,
  GraduationCap,
  Home,
  Library,
  PlaySquare,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AdminStatCards } from "@/features/admin/stat-cards";
import { api } from "@/lib/api/endpoints";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const stats = await api.admin.stats();

  return (
    <div className="space-y-8 max-w-6xl">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin paneli</h1>
          <p className="text-sm text-muted-foreground">
            Platformaning umumiy holati va boshqaruv vositalari.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button asChild variant="ghost">
            <Link href="/?home=1">
              <Home className="h-4 w-4" />
              Bosh sahifa
            </Link>
          </Button>
          <Button asChild>
            <Link href="/presentations">
              <PlaySquare className="h-4 w-4" />
              Taqdimotlar
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/pools">
              <Library className="h-4 w-4" />
              To'plamlar
            </Link>
          </Button>
          <Button asChild variant="outline" className="relative">
            <Link href="/admin/objections">
              <Flag className="h-4 w-4" />
              E'tirozlar
              {stats.objections.pending > 0 ? (
                <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">
                  {stats.objections.pending}
                </span>
              ) : null}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/tests">
              <GraduationCap className="h-4 w-4" />
              Testlar
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/teachers">
              <Users className="h-4 w-4" />
              O'qituvchilar
            </Link>
          </Button>
        </div>
      </header>

      <AdminStatCards stats={stats} />

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-lg font-semibold">Eng ko'p ko'rilgan taqdimotlar</h2>
            <p className="text-sm text-muted-foreground">Top 5 (jami ko'rishlar bo'yicha).</p>
          </div>
          <Link
            href="/presentations"
            className="text-sm font-medium hover:underline"
          >
            Hammasini ko'rish →
          </Link>
        </div>

        {stats.top_presentations.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Hozircha taqdimotlar yo'q</CardTitle>
              <CardDescription>
                Birinchi taqdimotni qo'shish uchun "Yangi taqdimot" tugmasini bosing.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0 divide-y">
              {stats.top_presentations.map((p) => (
                <Link
                  key={p.id}
                  href={`/presentations/${p.id}`}
                  className="flex items-center justify-between p-4 hover:bg-accent/40"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.title}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary">{p.subject}</Badge>
                      <Badge variant="outline">{p.grade}</Badge>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-sm text-muted-foreground tabular-nums">
                    <Eye className="h-3.5 w-3.5" />
                    {p.view_count}
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
