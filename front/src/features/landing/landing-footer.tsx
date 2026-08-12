import Link from "next/link";
import { GraduationCap } from "lucide-react";

import { ROUTES } from "@/lib/constants";

export function LandingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t bg-secondary/30">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 font-display text-base font-semibold">
          <img src="/yordamchim.svg" alt="Yordamchim Logo" className="w-7 h-7" />
          Yordamchim
        </div>
        <div className="text-xs text-muted-foreground">
          © {year} Yordamchim — barcha huquqlar himoyalangan.
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <Link
            href={ROUTES.LOGIN}
            className="hover:text-foreground transition-colors"
          >
            Kirish
          </Link>
          <Link
            href={ROUTES.REGISTER}
            className="hover:text-foreground transition-colors"
          >
            Ro'yxatdan o'tish
          </Link>
        </div>
      </div>
    </footer>
  );
}
