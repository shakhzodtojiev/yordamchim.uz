"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Flag,
  GraduationCap,
  Home,
  LayoutDashboard,
  Library,
  PlaySquare,
  Settings,
  Shield,
  Wallet,
} from "lucide-react";

import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";

// `teacherOnly` items disappear from the sidebar for admins — they get an
// equivalent entry under ADMIN_NAV that lands them on the admin surface
// instead. Keeps both "Kurslar" entries from cluttering the admin sidebar.
const NAV = [
  { href: ROUTES.DASHBOARD, label: "Bosh sahifa", icon: LayoutDashboard },
  { href: ROUTES.PRESENTATIONS, label: "Taqdimotlar", icon: PlaySquare },
  { href: ROUTES.COURSES, label: "Kurslar", icon: BookOpen, teacherOnly: true },
  { href: ROUTES.TESTS, label: "Testlar", icon: GraduationCap },
  { href: ROUTES.WALLET, label: "Hisobim", icon: Wallet },
  { href: ROUTES.SETTINGS, label: "Sozlamalar", icon: Settings },
];

const ADMIN_NAV = [
  { href: ROUTES.POOLS, label: "To'plamlar", icon: Library },
  { href: ROUTES.COURSES_ADMIN, label: "Kurslar", icon: BookOpen },
  { href: ROUTES.LESSONS_ADMIN, label: "Darslar", icon: GraduationCap },
  { href: ROUTES.OBJECTIONS, label: "E'tirozlar", icon: Flag },
  // Admin hub is exact-only — otherwise its `/admin` prefix would also
  // light up while the user is on `/admin/pools` or `/admin/teachers`.
  { href: "/admin", label: "Admin", icon: Shield, exact: true },
];

export function Sidebar({ canAdmin = false }: { canAdmin?: boolean }) {
  const pathname = usePathname();

  const items = canAdmin
    ? [...NAV.filter((i) => !("teacherOnly" in i && i.teacherOnly)), ...ADMIN_NAV]
    : NAV;

  return (
    <aside
      data-app-shell="sidebar"
      className="hidden md:flex md:flex-col md:w-60 md:shrink-0 border-r bg-card md:sticky md:top-0 md:h-screen"
    >
      <div className="px-6 py-5 border-b">
        <Link href={ROUTES.DASHBOARD} className="font-bold text-lg tracking-tight flex items-center gap-2">
          <img src="/yordamchim.svg" alt="Yordamchim Logo" className="w-7 h-7" />
          Yordamchim
        </Link>
      </div>
      <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (!("exact" in item && item.exact) &&
              pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-3">
        <Link
          href="/?home=1"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Home className="h-4 w-4" />
          Saytga qaytish
        </Link>
      </div>
    </aside>
  );
}
