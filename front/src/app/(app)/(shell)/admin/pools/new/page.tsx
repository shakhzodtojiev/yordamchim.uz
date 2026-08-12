import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PoolCreateForm } from "@/features/admin/pool-create-form";
import { api } from "@/lib/api/endpoints";

export const dynamic = "force-dynamic";

export default async function NewPoolPage() {
  const subjects = await api.subjects();

  return (
    <div className="max-w-2xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/admin/pools">
          <ArrowLeft className="h-4 w-4" />
          To'plamlar
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Yangi mavzulashtirilgan to'plam</CardTitle>
          <CardDescription>
            Sarlavha, fan, va turini belgilang. Yaratgandan so'ng savollarni
            qo'shasiz.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PoolCreateForm subjects={subjects} />
        </CardContent>
      </Card>
    </div>
  );
}
