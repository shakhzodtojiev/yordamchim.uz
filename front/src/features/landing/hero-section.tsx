"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, Sparkles, Timer } from "lucide-react";
import { motion } from "framer-motion";

import { FadeUp } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-hero-canvas">
      {/* Decorative orbs — sit absolutely behind the content for depth. */}
      <div
        aria-hidden
        className="landing-orb h-72 w-72 bg-primary/40 -top-20 -left-20 animate-float-slow"
      />
      <div
        aria-hidden
        className="landing-orb h-80 w-80 bg-[hsl(var(--gold)/0.45)] top-10 right-0 animate-float-slower"
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28 lg:py-32 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-center">
        <div className="space-y-6">
          <FadeUp>
            <span className="inline-flex items-center gap-2 rounded-full border bg-card/70 backdrop-blur px-3 py-1 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--gold))]" />
              O'qituvchilar uchun zamonaviy platforma
            </span>
          </FadeUp>

          <FadeUp delay={0.05}>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.05] tracking-tight">
              Bilim oshiriladigan{" "}
              <span className="bg-gradient-to-r from-primary via-primary to-[hsl(var(--gold))] bg-clip-text text-transparent">
                yagona joy
              </span>
            </h1>
          </FadeUp>

          <FadeUp delay={0.1}>
            <p className="text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed">
              Yordamchim — attestatsiya testlari, mock sinovlar va shaxsiy
              taqdimotlar uchun ustozning barchani bir joyga jamlovchi
              platforma. Tartibli, sodda, ishonchli.
            </p>
          </FadeUp>

          <FadeUp delay={0.15}>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button asChild size="lg">
                <Link href={ROUTES.REGISTER}>
                  Bepul ro'yxatdan o'tish
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href={ROUTES.LOGIN}>Akkauntim bor</Link>
              </Button>
            </div>
          </FadeUp>

          <FadeUp delay={0.2}>
            <div className="flex flex-wrap items-center gap-6 pt-6 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                Mavzulashtirilgan to'plamlar
              </span>
              <span className="inline-flex items-center gap-2">
                <Timer className="h-4 w-4 text-primary" />
                Mock sinovlar
              </span>
              <span className="inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[hsl(var(--gold))]" />
                Real-time natija
              </span>
            </div>
          </FadeUp>
        </div>

        <HeroIllustration />
      </div>
    </section>
  );
}

/** Animated illustration block. Pure CSS / SVG — no real images required and
 *  it scales perfectly on any density. */
function HeroIllustration() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1], delay: 0.1 }}
      className="relative aspect-[5/4] w-full max-w-md ml-auto"
    >
      {/* Stacked floating cards — visual metaphor for "to'plamlar". */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-0 right-0 w-[78%] aspect-[4/3] rounded-2xl border bg-card shadow-elevated-lg p-5 z-10"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Matematika · Oson
          </span>
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-success/15 text-success text-[11px] font-semibold">
            ✓
          </span>
        </div>
        <div className="mt-3 text-base font-medium leading-snug">
          12 × 8 = ?
        </div>
        <div className="mt-3 space-y-2">
          {[
            ["A", "96", true],
            ["B", "84", false],
            ["C", "104", false],
          ].map(([k, v, ok]) => (
            <div
              key={k as string}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
                ok ? "border-primary/40 bg-primary/5" : ""
              }`}
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold">
                {k as string}
              </span>
              {v as string}
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
        className="absolute bottom-2 left-0 w-[60%] aspect-[4/3] rounded-2xl border glass-card p-4"
      >
        <div className="text-[11px] text-muted-foreground">Sizning natijangiz</div>
        <div className="mt-1 font-display text-3xl font-semibold">
          92<span className="text-muted-foreground text-lg">%</span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "92%" }}
            transition={{ duration: 1.4, delay: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className="h-full bg-primary-gradient"
          />
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground">
          14/15 to'g'ri javob
        </div>
      </motion.div>

      {/* Tiny floating gold sparkle for luxury feel. */}
      <motion.div
        animate={{ rotate: [0, 12, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-8 left-2 h-10 w-10 rounded-xl bg-gold-gradient grid place-items-center shadow-elevated-md"
      >
        <Sparkles className="h-5 w-5 text-[hsl(var(--gold-foreground))]" />
      </motion.div>
    </motion.div>
  );
}
