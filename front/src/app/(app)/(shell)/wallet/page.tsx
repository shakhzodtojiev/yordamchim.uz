import { ArrowDownLeft, ArrowUpRight, Wallet as WalletIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api/endpoints";
import { GENERATION_PRICE } from "@/lib/constants";
import { cn, formatSom } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const [wallet, transactions] = await Promise.all([
    api.walletMe(),
    api.walletTransactions(),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Hisobim</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Balans, xaridlar va sotuvdan tushgan daromad.
        </p>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-6 flex items-center justify-between gap-4 bg-soft-gradient">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <WalletIcon className="h-3.5 w-3.5" /> Joriy balans
            </div>
            <div className="text-3xl font-bold tabular-nums">
              {formatSom(wallet.balance)}
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground max-w-[220px]">
            Balansni to&apos;ldirish uchun administrator bilan bog&apos;laning.
            <div className="mt-1">
              Taqdimot generatsiyasi: {formatSom(GENERATION_PRICE)}.
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Tranzaksiyalar</h2>
        {transactions.results.length === 0 ? (
          <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
            Hali tranzaksiyalar yo&apos;q.
          </div>
        ) : (
          <div className="rounded-xl border bg-card divide-y">
            {transactions.results.map((tx) => {
              const incoming = tx.amount > 0;
              return (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 p-3 sm:p-4"
                >
                  <div
                    className={cn(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-full",
                      incoming
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-destructive/10 text-destructive",
                    )}
                  >
                    {incoming ? (
                      <ArrowDownLeft className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {tx.type_display}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {tx.presentation_title || tx.note || ""}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        incoming
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-foreground",
                      )}
                    >
                      {incoming ? "+" : ""}
                      {formatSom(tx.amount)}
                    </div>
                    <div className="text-[11px] text-muted-foreground tabular-nums">
                      {new Date(tx.created_at).toLocaleDateString("uz-UZ")}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
