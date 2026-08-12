"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { GenerationJob } from "@/types/api";

import { pollGenerationJobAction } from "./actions";

export function JobStatus({ initial }: { initial: GenerationJob }) {
  const [job, setJob] = useState(initial);
  const active = job.status === "pending" || job.status === "processing";

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(async () => {
      try {
        setJob(await pollGenerationJobAction(job.id));
      } catch {
        // Transient network hiccup — keep polling.
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [active, job.id]);

  return (
    <Card>
      <CardContent className="p-8 text-center space-y-4">
        {active ? (
          <>
            <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
            <div className="space-y-1">
              <h1 className="text-lg font-semibold">
                Taqdimot tayyorlanmoqda
              </h1>
              <p className="text-sm text-muted-foreground">
                &quot;{job.topic}&quot; — {job.status_display}. Bu bir necha
                soniya olishi mumkin, sahifani yopmang.
              </p>
            </div>
          </>
        ) : job.status === "done" ? (
          <>
            <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500" />
            <div className="space-y-1">
              <h1 className="text-lg font-semibold">Tayyor!</h1>
              <p className="text-sm text-muted-foreground">
                &quot;{job.topic}&quot; taqdimoti yaratildi.
              </p>
            </div>
            {job.presentation ? (
              <Button asChild size="lg">
                <Link href={`/presentations/${job.presentation}`}>
                  Taqdimotni ochish
                </Link>
              </Button>
            ) : null}
          </>
        ) : (
          <>
            <XCircle className="h-10 w-10 mx-auto text-destructive" />
            <div className="space-y-1">
              <h1 className="text-lg font-semibold">Xatolik yuz berdi</h1>
              <p className="text-sm text-muted-foreground">
                {job.error || "Generatsiya bajarilmadi."} To&apos;langan summa
                hisobingizga qaytarildi.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/presentations/create">Qayta urinish</Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
