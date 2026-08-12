"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { MathText } from "@/components/ui/math-text";
import type { AdminObjection, ObjectionStatus } from "@/types/api";

import { updateObjectionAction } from "./admin-actions";

const STATUS_VARIANT: Record<
  ObjectionStatus,
  "warning" | "success" | "destructive"
> = {
  pending: "warning",
  resolved: "success",
  rejected: "destructive",
};

export function AdminObjectionsList({ items }: { items: AdminObjection[] }) {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          E'tirozlar yo'q.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((o) => (
        <ObjectionRow key={o.id} item={o} />
      ))}
    </div>
  );
}

function ObjectionRow({ item }: { item: AdminObjection }) {
  const router = useRouter();
  const [note, setNote] = useState(item.admin_note ?? "");
  const [isPending, startTransition] = useTransition();

  const update = (status: ObjectionStatus) => {
    startTransition(async () => {
      const result = await updateObjectionAction(item.id, {
        status,
        admin_note: note.trim(),
      });
      if (result.ok) {
        toast.success("E'tiroz holati yangilandi.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={STATUS_VARIANT[item.status]}>
                {item.status_label}
              </Badge>
              <Badge variant="outline">{item.reason_label}</Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(item.created_at).toLocaleString("uz-UZ")}
              </span>
            </div>
            <div className="text-sm">
              <span className="font-medium">
                {item.user_full_name || item.user_email}
              </span>{" "}
              <span className="text-muted-foreground">
                ({item.user_email})
              </span>
            </div>
          </div>
          <Link
            href={`/admin/pools/${item.question_pool_id}`}
            className="text-xs font-medium text-primary hover:underline"
          >
            {item.question_pool_title} →
          </Link>
        </div>

        <div className="rounded-md border bg-muted/30 p-3 space-y-1">
          <div className="text-xs text-muted-foreground">Savol matni</div>
          {item.question_text ? (
            <MathText
              as="p"
              text={item.question_text}
              className="text-sm"
            />
          ) : (
            <p className="text-sm italic text-muted-foreground">(matn yo'q)</p>
          )}
        </div>

        {item.body ? (
          <div className="rounded-md border p-3 space-y-1">
            <div className="text-xs text-muted-foreground">Foydalanuvchi izohi</div>
            <p className="text-sm whitespace-pre-wrap">{item.body}</p>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor={`note-${item.id}`} className="text-xs">
            Admin izohi
          </Label>
          <textarea
            id={`note-${item.id}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Hal qilish bo'yicha izoh yozing..."
            className="flex w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          {item.status !== "resolved" ? (
            <Button
              variant="success"
              size="sm"
              onClick={() => update("resolved")}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Hal qilindi
            </Button>
          ) : null}
          {item.status !== "rejected" ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => update("rejected")}
              disabled={isPending}
            >
              Rad etish
            </Button>
          ) : null}
          {item.status !== "pending" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => update("pending")}
              disabled={isPending}
            >
              Pending'ga qaytarish
            </Button>
          ) : null}
        </div>

        {item.resolved_at ? (
          <p className="text-xs text-muted-foreground">
            Hal qilindi: {new Date(item.resolved_at).toLocaleString("uz-UZ")}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
