"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ROUTES } from "@/lib/constants";
import { formatSom } from "@/lib/utils";
import type { PresentationDetail } from "@/types/api";

import { purchasePresentationAction } from "./actions";

/** Shown in place of the viewer when a listed teacher deck isn't owned yet. */
export function BuyPanel({ presentation }: { presentation: PresentationDetail }) {
  const router = useRouter();

  async function buy() {
    const res = await purchasePresentationAction(presentation.id);
    if (res.ok) {
      toast.success("Taqdimot sotib olindi! Endi ochishingiz mumkin.");
      // Re-render: is_locked flips to false and the viewer replaces this panel.
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Card>
      <CardContent className="p-6 sm:p-10 text-center space-y-5">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-secondary">
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Bu taqdimot qulflangan</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Ko&apos;rish uchun sotib oling. To&apos;langan summa taqdimot
            muallifiga o&apos;tadi.
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 flex-wrap text-sm">
          <Badge variant="secondary">{presentation.subject.name}</Badge>
          <Badge variant="outline">{presentation.grade.name}</Badge>
          <span className="text-muted-foreground">
            {presentation.slide_count} slayd
          </span>
        </div>

        {presentation.author_name ? (
          <p className="text-xs text-muted-foreground">
            Muallif: {presentation.author_name}
          </p>
        ) : null}

        <div className="text-3xl font-bold tracking-tight">
          {formatSom(presentation.price)}
        </div>

        <div className="flex flex-col items-center gap-2">
          <ConfirmDialog
            trigger={
              <Button size="lg" className="gap-2">
                <ShoppingCart className="h-4 w-4" />
                Sotib olish
              </Button>
            }
            title="Taqdimotni sotib olasizmi?"
            description={`Hisobingizdan ${formatSom(
              presentation.price,
            )} yechiladi va taqdimot ochiladi.`}
            confirmLabel="Ha, sotib olaman"
            confirmVariant="default"
            action={buy}
          />
          <p className="text-xs text-muted-foreground">
            Balans yetarli emasmi?{" "}
            <Link href={ROUTES.WALLET} className="underline">
              Hisobim
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
