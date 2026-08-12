import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  Eye,
  Flag,
  GraduationCap,
  Library,
  PlaySquare,
  Shield,
  Users,
} from "lucide-react";

import { FadeUp, Stagger, StaggerItem } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AdminStats, User } from "@/types/api";

type Props = {
  user: User;
  stats: AdminStats;
};

/** Admin home — KPI strip + a row of operational shortcuts (pools, tests,
 *  presentations, objections) + the top-five presentations table. Designed
 *  to surface what an admin actually needs first thing: any pending
 *  objections that need triage, plus quick-create entry points. */
export function AdminDashboard({ user, stats }: Props) {
  const firstName = user.full_name?.split(" ")[0] || "Admin";
  const pending = stats.objections.pending;

  return (
    <div className="space-y-8 max-w-6xl">
      <FadeUp>
        <header className="rounded-2xl border bg-soft-gradient p-6 sm:p-8 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-card/70 backdrop-blur px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground mb-2">
              <Shield className="h-3 w-3 text-primary" />
              Admin paneli
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Salom, {firstName}!
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Platformaning umumiy holati va tezkor boshqaruv havolalari.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button asChild>
              <Link href="/admin/pools">
                <Library className="h-4 w-4" />
                To'plamlar
              </Link>
            </Button>
            <Button asChild variant="outline" className="relative">
              <Link href="/admin/objections">
                <Flag className="h-4 w-4" />
                E'tirozlar
                {pending > 0 ? (
                  <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">
                    {pending}
                  </span>
                ) : null}
              </Link>
            </Button>
          </div>
        </header>
      </FadeUp>

      <Stagger className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="O'qituvchilar"
          value={stats.teachers.total}
          hint={`${stats.teachers.onboarded} onboarding tugatgan`}
        />
        <StatCard
          icon={PlaySquare}
          label="Taqdimotlar"
          value={stats.presentations.total}
          hint={`${stats.presentations.published} chop etilgan`}
        />
        <StatCard
          icon={GraduationCap}
          label="Topshirilgan testlar"
          value={stats.tests.attempts_total}
          hint={`So'nggi 7 kun: ${stats.tests.attempts_7d}`}
        />
        <StatCard
          icon={ClipboardList}
          label="O'rtacha ball"
          value={`${stats.tests.average_score}%`}
          hint="Yakunlangan testlar bo'yicha"
        />
      </Stagger>

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-lg font-semibold">Tez kirish</h2>
            <p className="text-sm text-muted-foreground">
              Eng ko'p ishlatiladigan admin amallari.
            </p>
          </div>
        </div>
        <Stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              icon: Library,
              title: "Mavzulashtirilgan to'plamlar",
              body: "Savol banklarini boshqaring va yangi to'plam qo'shing.",
              href: "/admin/pools",
            },
            {
              icon: GraduationCap,
              title: "Testlar",
              body: "Oddiy va mock testlarni ko'rib chiqing, tahrirlang.",
              href: "/tests",
            },
            {
              icon: PlaySquare,
              title: "Taqdimotlar",
              body: ".pptx fayllarni yuklang va admin paneldan boshqaring.",
              href: "/presentations",
            },
            {
              icon: Users,
              title: "O'qituvchilar",
              body: "Ro'yxat va aktivlik — kim qaysi fanga kirgan.",
              href: "/admin/teachers",
            },
            {
              icon: Flag,
              title: "E'tirozlar",
              body: "Foydalanuvchi e'tirozlarini ko'rib chiqing va hal qiling.",
              href: "/admin/objections",
              badge: pending > 0 ? `${pending}` : undefined,
            },
          ].map((q) => (
            <StaggerItem key={q.href}>
              <Link href={q.href} className="block">
                <Card interactive className="h-full">
                  <CardContent className="p-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="grid place-items-center h-10 w-10 rounded-xl bg-primary/10 text-primary">
                        <q.icon className="h-5 w-5" />
                      </div>
                      {q.badge ? (
                        <Badge variant="destructive">{q.badge}</Badge>
                      ) : null}
                    </div>
                    <div className="font-semibold text-sm leading-snug">
                      {q.title}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {q.body}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-lg font-semibold">Eng ko'p ko'rilgan taqdimotlar</h2>
            <p className="text-sm text-muted-foreground">Top 5 (jami ko'rishlar bo'yicha).</p>
          </div>
          <Link
            href="/presentations"
            className="text-sm font-medium inline-flex items-center gap-1 hover:underline"
          >
            Hammasini ko'rish <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {stats.top_presentations.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Hozircha taqdimotlar yo'q.
            </CardContent>
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
                      {p.grade ? (
                        <Badge variant="outline">{p.grade}</Badge>
                      ) : null}
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

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <StaggerItem>
      <Card className="h-full">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{label}</span>
            <div className="grid place-items-center h-8 w-8 rounded-lg bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </div>
          </div>
          <div className="font-display text-3xl font-semibold mt-2 tabular-nums">
            {value}
          </div>
          {hint ? (
            <div className="text-xs text-muted-foreground mt-1">{hint}</div>
          ) : null}
        </CardContent>
      </Card>
    </StaggerItem>
  );
}
