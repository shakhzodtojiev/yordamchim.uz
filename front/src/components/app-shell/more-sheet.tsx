"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Flag,
  Library,
  MoreHorizontal,
  Settings,
  Shield,
  Wallet,
  X,
} from "lucide-react";

import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Item = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
};

/** Bottom sheet that holds the overflow menu items. Mounted from BottomNav
 *  so the trigger lives in the tab bar; the sheet slides up over the page
 *  and dismisses on backdrop tap / route change / Esc. */
export function MoreSheet({
  canAdmin,
  pendingObjections = 0,
}: {
  canAdmin: boolean;
  pendingObjections?: number;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close when route changes (user picked an item).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while open + close on Esc.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items: Item[] = [
    // Teacher-side Kurslar hidden for admins — they get the admin variant
    // below which lands them on /admin/courses directly.
    { href: ROUTES.WALLET, label: "Hisobim", icon: Wallet },
    ...(canAdmin
      ? []
      : [{ href: ROUTES.COURSES, label: "Kurslar", icon: BookOpen }]),
    { href: ROUTES.SETTINGS, label: "Sozlamalar", icon: Settings },
    ...(canAdmin
      ? [
          { href: ROUTES.POOLS, label: "To'plamlar", icon: Library },
          { href: ROUTES.COURSES_ADMIN, label: "Kurslar", icon: BookOpen },
          { href: ROUTES.LESSONS_ADMIN, label: "Darslar", icon: BookOpen },
          {
            href: ROUTES.OBJECTIONS,
            label: "E'tirozlar",
            icon: Flag,
            badge: pendingObjections,
          },
          { href: "/admin", label: "Admin", icon: Shield },
        ]
      : []),
  ];

  // Highlight the trigger when any of the sheet's items is the active route.
  const triggerActive = items.some(
    (i) => pathname === i.href || pathname.startsWith(`${i.href}/`),
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
          triggerActive ? "text-primary" : "text-muted-foreground",
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Boshqa menyu"
      >
        <span className="relative">
          <MoreHorizontal className="h-5 w-5" />
          {pendingObjections > 0 ? (
            <span className="absolute -top-1.5 -right-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-semibold text-destructive-foreground">
              {pendingObjections}
            </span>
          ) : null}
        </span>
        <span>Boshqa</span>
      </button>

      {open ? (
        <div
          className="md:hidden fixed inset-0 z-50 flex flex-col justify-end animate-fade-up"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" />

          {/* Sheet */}
          <div className="relative bg-card border-t rounded-t-2xl shadow-elevated-lg p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] mx-auto w-full max-w-md">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold">Boshqa menyular</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Yopish"
                className="grid place-items-center h-8 w-8 rounded-full hover:bg-accent text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <ul className="grid grid-cols-2 gap-2">
              {items.map((it) => {
                const active =
                  pathname === it.href || pathname.startsWith(`${it.href}/`);
                const Icon = it.icon;
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border p-3 transition-colors",
                        active
                          ? "border-primary bg-primary/5 text-foreground"
                          : "hover:bg-accent",
                      )}
                    >
                      <span className="grid place-items-center h-9 w-9 rounded-lg bg-primary/10 text-primary shrink-0">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="flex-1 text-sm font-medium leading-tight">
                        {it.label}
                      </span>
                      {it.badge && it.badge > 0 ? (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">
                          {it.badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
