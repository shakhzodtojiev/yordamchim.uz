"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Wallet as WalletIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatSom } from "@/lib/utils";
import type { AdminWallet } from "@/types/api";

import { payoutTeacherAction, topupTeacherAction } from "./wallet-actions";

export function TeacherWalletPanel({
  teacherId,
  wallet,
}: {
  teacherId: number;
  wallet: AdminWallet;
}) {
  const router = useRouter();
  const [balance, setBalance] = useState(wallet.balance);
  const [amount, setAmount] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<null | "topup" | "payout">(null);

  async function run(kind: "topup" | "payout") {
    if (amount === "" || Number(amount) <= 0) {
      toast.error("Summani kiriting.");
      return;
    }
    setPending(kind);
    const fn = kind === "topup" ? topupTeacherAction : payoutTeacherAction;
    const res = await fn(teacherId, Number(amount), note || undefined);
    if (res.ok) {
      setBalance(res.balance);
      setAmount("");
      setNote("");
      toast.success(
        kind === "topup" ? "Balans to'ldirildi." : "Payout bajarildi.",
      );
      router.refresh();
    } else {
      toast.error(res.error);
    }
    setPending(null);
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold inline-flex items-center gap-2">
            <WalletIcon className="h-4 w-4" /> Hisob
          </div>
          <div className="text-xl font-bold tabular-nums">
            {formatSom(balance)}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="wallet-amount">Summa (so&apos;m)</Label>
            <Input
              id="wallet-amount"
              type="number"
              min={1}
              step={1000}
              value={amount}
              onChange={(e) =>
                setAmount(e.target.value === "" ? "" : Number(e.target.value))
              }
              placeholder="50000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wallet-note">Izoh (ixtiyoriy)</Label>
            <Input
              id="wallet-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Naqd to'lov"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={() => run("topup")}
            disabled={pending !== null}
          >
            {pending === "topup" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Balansni to&apos;ldirish
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => run("payout")}
            disabled={pending !== null}
          >
            {pending === "payout" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Yechib olish
          </Button>
        </div>

        {wallet.transactions.length > 0 ? (
          <div className="border-t pt-3 space-y-1.5">
            <div className="text-xs text-muted-foreground">
              So&apos;nggi tranzaksiyalar
            </div>
            {wallet.transactions.slice(0, 6).map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-muted-foreground truncate">
                  {tx.type_display}
                  {tx.presentation_title ? ` — ${tx.presentation_title}` : ""}
                </span>
                <span
                  className={
                    tx.amount > 0
                      ? "tabular-nums text-emerald-600 dark:text-emerald-400"
                      : "tabular-nums"
                  }
                >
                  {tx.amount > 0 ? "+" : ""}
                  {formatSom(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
