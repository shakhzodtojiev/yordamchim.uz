"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Reveal } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";

export function CtaSection() {
  return (
    <section className="relative py-20 sm:py-28 mx-auto max-w-6xl px-4 sm:px-6">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl border bg-card p-10 sm:p-16 text-center">
          {/* Decorative orbs */}
          <div
            aria-hidden
            className="landing-orb h-72 w-72 bg-primary/30 -top-16 -left-16 animate-float-slow"
          />
          <div
            aria-hidden
            className="landing-orb h-72 w-72 bg-[hsl(var(--gold)/0.4)] -bottom-20 -right-10 animate-float-slower"
          />

          <div className="relative space-y-5">
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight">
              Bilim sayohatini bugundan boshlang
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Bepul ro'yxatdan o'ting, fan tanlang va birinchi testingizni shu
              bugun ishlang. Hech qanday karta talab qilinmaydi.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button asChild size="lg">
                <Link href={ROUTES.REGISTER}>
                  Bepul boshlash
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href={ROUTES.LOGIN}>Login</Link>
              </Button>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
