import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPercent(n: number) {
  return `${Math.round(n)}%`;
}

/** Whole-so'm formatting with space thousands separators, e.g. 15000 -> "15 000 so'm". */
export function formatSom(amount: number): string {
  const grouped = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${grouped} so'm`;
}

export function formatTime(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function deadlineToSeconds(deadlineIso: string): number {
  return Math.floor((new Date(deadlineIso).getTime() - Date.now()) / 1000);
}
