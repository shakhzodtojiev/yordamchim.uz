"use client";

import {
  BookCheck,
  Layers,
  PlaySquare,
  ShieldCheck,
  Sparkles,
  Timer,
} from "lucide-react";

import { Reveal, RevealStagger, StaggerItem } from "@/components/motion";

const FEATURES: Array<{
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}> = [
  {
    icon: Layers,
    title: "Mavzulashtirilgan to'plamlar",
    body: "Har bir fan bo'yicha alohida savol banklari. Admin to'plam yaratadi, savol qo'shadi — testlar shu bankdan random tortadi.",
  },
  {
    icon: BookCheck,
    title: "3 xil savol turi",
    body: "Bitta to'g'ri javob, bir nechta to'g'ri javob va mos qo'yish. Har savol qiyinligi bilan: oson, o'rta, qiyin.",
  },
  {
    icon: Timer,
    title: "Mock va oddiy testlar",
    body: "Oddiy testlarni xohlagan paytda. Mock testlarni belgilangan vaqt oralig'ida — bir martagina topshirish.",
  },
  {
    icon: PlaySquare,
    title: "Slayd taqdimotlar",
    body: "Tayyor o'quv slaydlar foydalanuvchining fan va sinfi bo'yicha avtomatik tanlanadi.",
  },
  {
    icon: ShieldCheck,
    title: "Server tomonida ballash",
    body: "Vaqt va to'g'ri javoblar serverda hisoblanadi. Foydalanuvchi javoblarni almashtira olmaydi.",
  },
  {
    icon: Sparkles,
    title: "E'tirozlar tizimi",
    body: "O'qituvchi savol yoki javobga e'tiroz bildirishi mumkin — admin ko'rib chiqadi va tahrir qiladi.",
  },
];

export function FeaturesSection() {
  return (
    <section
      id="features"
      className="relative py-20 sm:py-28 mx-auto max-w-6xl px-4 sm:px-6"
    >
      <Reveal className="text-center max-w-2xl mx-auto space-y-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-accent text-accent-foreground px-3 py-1 text-xs font-medium">
          Imkoniyatlar
        </span>
        <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
          Test va o'qish jarayoni — bir tizimda
        </h2>
        <p className="text-muted-foreground">
          O'qituvchining vaqtini tejash uchun mo'ljallangan: kontent admin
          tomonida tartibli, foydalanuvchi tomonida sodda ko'rinadi.
        </p>
      </Reveal>

      <RevealStagger className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {FEATURES.map((f) => (
          <StaggerItem key={f.title}>
            <FeatureCard {...f} />
          </StaggerItem>
        ))}
      </RevealStagger>
    </section>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="group relative h-full rounded-2xl border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-elevated-lg hover:border-primary/30">
      <div className="grid place-items-center h-11 w-11 rounded-xl bg-primary/10 text-primary mb-4 transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-semibold text-base leading-snug">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
        {body}
      </p>
    </div>
  );
}
