import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TestCreateForm } from "@/features/admin/test-create-form";
import { api } from "@/lib/api/endpoints";

export const dynamic = "force-dynamic";

export default async function NewTestPage() {
  const user = await api.me();
  if (!user.can_admin) notFound();

  const poolsPage = await api.admin.pools();

  return (
    <div className="max-w-2xl space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/tests">
          <ArrowLeft className="h-4 w-4" />
          Testlar
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Yangi test</CardTitle>
          <CardDescription>
            Test mavjud mavzulashtirilgan to'plamdan foydalanadi — to'plamdagi
            savollardan har attempt'da tasodifiy tanlanadi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TestCreateForm pools={poolsPage.results} />
        </CardContent>
      </Card>
    </div>
  );
}
