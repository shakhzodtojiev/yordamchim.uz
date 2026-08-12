"use client";

import { ClipboardCheck, GraduationCap, UserPlus } from "lucide-react";

import { Reveal, RevealStagger, StaggerItem } from "@/components/motion";

const STEPS = [
  {
    no: "01",
    icon: UserPlus,
    title: "Ro'yxatdan o'ting",
    body: "Email + parol bilan tezda akkaunt oching. Onboarding'da fan va sinflarni tanlaysiz.",
  },
  {
    no: "02",
    icon: GraduationCap,
    title: "Mos kontentni oling",
    body: "Tanlovingizga ko'ra taqdimot va testlar avtomatik shaxsiylashtiriladi.",
  },
  {
    no: "03",
    icon: ClipboardCheck,
    title: "Test ishlang, natijani ko'ring",
    body: "Server vaqtni ushlab turadi, ballarni hisoblaydi. Tugashi bilan to'liq tahlil.",
  },
];

export function HowSection() {
  return (
    <section
      id="how"
      className="relative py-20 sm:py-28 bg-secondary/40"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="text-center max-w-2xl mx-auto space-y-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-accent text-accent-foreground px-3 py-1 text-xs font-medium">
            Ish jarayoni
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
            3 oddiy qadamda boshlang
          </h2>
          <p className="text-muted-foreground">
            Hech qanday murakkablik yo'q — birinchi testingizni 5 daqiqada
            ishlay olasiz.
          </p>
        </Reveal>

        <RevealStagger
          stagger={0.12}
          className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6 relative"
        >
          {/* Connector line on desktop, sits behind the cards */}
          <div
            aria-hidden
            className="hidden md:block absolute top-12 left-[15%] right-[15%] h-px bg-gradient-to-r from-transparent via-border to-transparent"
          />
          {STEPS.map((s, i) => (
            <StaggerItem key={s.no}>
              <StepCard step={s} delay={i * 0.05} />
            </StaggerItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  );
}

function StepCard({
  step,
}: {
  step: (typeof STEPS)[number];
  delay?: number;
}) {
  const Icon = step.icon;
  return (
    <div className="relative flex flex-col items-center text-center px-6 py-8 rounded-2xl bg-card border shadow-elevated-sm">
      <div className="absolute -top-4 inline-flex h-8 px-3 items-center rounded-full bg-foreground text-background font-display text-xs font-semibold tracking-wider">
        {step.no}
      </div>
      <div className="grid place-items-center h-14 w-14 rounded-2xl bg-primary/10 text-primary mb-4">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="font-semibold text-base">{step.title}</h3>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-xs">
        {step.body}
      </p>
    </div>
  );
}
