"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

import { Reveal } from "@/components/motion";

const STATS: Array<{ value: number; suffix?: string; label: string }> = [
  { value: 10, suffix: "+", label: "Fan yo'nalishi" },
  { value: 3, label: "Savol turi" },
  { value: 99, suffix: "%", label: "Server-side ballash" },
  { value: 24, suffix: "/7", label: "Mavjudligi" },
];

export function StatsSection() {
  return (
    <section id="stats" className="relative py-20 sm:py-28 mx-auto max-w-6xl px-4 sm:px-6">
      <Reveal className="text-center max-w-2xl mx-auto space-y-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-accent text-accent-foreground px-3 py-1 text-xs font-medium">
          Reqamlar
        </span>
        <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
          Ishonarli, sodda, kengayadigan
        </h2>
      </Reveal>

      <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-6">
        {STATS.map((s, i) => (
          <StatCounter key={s.label} {...s} delay={i * 0.1} />
        ))}
      </div>
    </section>
  );
}

function StatCounter({
  value,
  suffix,
  label,
  delay = 0,
}: {
  value: number;
  suffix?: string;
  label: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let start: number | null = null;
    const duration = 1200;
    const tick = (ts: number) => {
      if (start === null) start = ts;
      const elapsed = ts - start;
      const progress = Math.min(1, elapsed / duration);
      // Ease-out for a more "settled" feel.
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * value));
      if (progress < 1) requestAnimationFrame(tick);
    };
    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [inView, value]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 14 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.4, 0, 0.2, 1] }}
      className="rounded-2xl border bg-card p-6 text-center shadow-elevated-sm"
    >
      <div className="font-display text-4xl sm:text-5xl font-semibold tracking-tight bg-gradient-to-br from-foreground to-primary bg-clip-text text-transparent">
        {count}
        {suffix}
      </div>
      <div className="mt-2 text-sm text-muted-foreground">{label}</div>
    </motion.div>
  );
}
