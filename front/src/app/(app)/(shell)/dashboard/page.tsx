import Link from "next/link";
import { ArrowRight, GraduationCap, PlaySquare } from "lucide-react";

import { FadeUp, Stagger, StaggerItem } from "@/components/motion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AdminDashboard } from "@/features/dashboard/admin-dashboard";
import { StatsCards } from "@/features/dashboard/stats-cards";
import { PresentationCard } from "@/features/presentations/presentation-card";
import { api } from "@/lib/api/endpoints";
import { ROUTES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await api.me();

  // Admin and teacher see different data — admin gets platform KPIs +
  // operational shortcuts; teacher keeps the personalized study home.
  if (user.can_admin) {
    const stats = await api.admin.stats();
    return <AdminDashboard user={user} stats={stats} />;
  }

  const [stats, recommended] = await Promise.all([
    api.stats(),
    api.recommendedPresentations(),
  ]);

  const firstName = user.full_name?.split(" ")[0] || "Ustoz";

  return (
    <div className="space-y-8 max-w-6xl">
      <FadeUp>
        <header className="rounded-2xl border bg-soft-gradient p-6 sm:p-8 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Assalomu alaykum, {firstName}!
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Bugungi o'qish uchun nimadan boshlaymiz?
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild>
              <Link href={ROUTES.TESTS}>
                <GraduationCap className="h-4 w-4" />
                Test boshlash
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={ROUTES.PRESENTATIONS}>
                <PlaySquare className="h-4 w-4" />
                Taqdimotlar
              </Link>
            </Button>
          </div>
        </header>
      </FadeUp>

      <FadeUp delay={0.05}>
        <StatsCards stats={stats} />
      </FadeUp>

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-lg font-semibold">Siz uchun mos taqdimotlar</h2>
            <p className="text-sm text-muted-foreground">
              Tanlangan fan va sinflar bo'yicha avtomatik tanlandi.
            </p>
          </div>
          <Link
            href={ROUTES.PRESENTATIONS}
            className="text-sm font-medium inline-flex items-center gap-1 hover:underline"
          >
            Hammasini ko'rish <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {recommended.length === 0 ? (
          <EmptyRecommendations />
        ) : (
          <Stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recommended.map((p) => (
              <StaggerItem key={p.id}>
                <PresentationCard item={p} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </section>
    </div>
  );
}

function EmptyRecommendations() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hozircha mos taqdimotlar yo'q</CardTitle>
        <CardDescription>
          Tanlovlaringizga mos kontent qo'shilishi bilan shu yerda paydo bo'ladi.
          Sozlamalardan fan/sinflarni kengaytirib ko'rishingiz mumkin.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline">
          <Link href={ROUTES.SETTINGS}>Sozlamalarga o'tish</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
