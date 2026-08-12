"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GraduationCap,
  LayoutDashboard,
  PlaySquare,
} from "lucide-react";

import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";

import { MoreSheet } from "./more-sheet";

// Mobile primary tabs — capped at 3 destinations + a "Boshqa" sheet so the
// bar fits comfortably on small screens. Anything else (Sozlamalar, plus
// admin pages for admins) lives inside the sheet.
const NAV = [
  { href: ROUTES.DASHBOARD, label: "Bosh sahifa", icon: LayoutDashboard },
  { href: ROUTES.PRESENTATIONS, label: "Taqdimot", icon: PlaySquare },
  { href: ROUTES.TESTS, label: "Test", icon: GraduationCap },
];

export function BottomNav({
  canAdmin = false,
  pendingObjections = 0,
}: {
  canAdmin?: boolean;
  pendingObjections?: number;
}) {
  const pathname = usePathname();

  return (
    <nav
      data-app-shell="bottom-nav"
      className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur"
      // pb-safe lets the bar respect iOS/Android home-indicator safe areas.
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex h-16">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon
                  className={cn(
                    "h-5 w-5",
                    active && "drop-shadow-[0_0_6px_hsl(var(--primary)/0.45)]",
                  )}
                />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
        <li className="flex-1">
          <MoreSheet canAdmin={canAdmin} pendingObjections={pendingObjections} />
        </li>
      </ul>
    </nav>
  );
}
