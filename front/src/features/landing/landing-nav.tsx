import Link from "next/link";
import { GraduationCap, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";

export function LandingNav({ authed = false }: { authed?: boolean }) {
  return (
    <header
      data-landing-only
      className="sticky top-0 z-30 border-b border-border/40 bg-background/70 backdrop-blur-xl"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight"
        >
          <img src="/yordamchim.svg" alt="Yordamchim Logo" className="w-8 h-8" />
          Yordamchim
        </Link>

        <nav className="hidden sm:flex items-center gap-8 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition-colors">
            Imkoniyatlar
          </a>
          <a href="#how" className="hover:text-foreground transition-colors">
            Ish jarayoni
          </a>
          <a href="#stats" className="hover:text-foreground transition-colors">
            Statistika
          </a>
        </nav>

        <div className="flex items-center gap-2">
          {authed ? (
            <Button asChild size="sm">
              <Link href={ROUTES.DASHBOARD}>
                Boshqaruv paneli
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href={ROUTES.LOGIN}>Kirish</Link>
              </Button>
              <Button asChild size="sm">
                <Link href={ROUTES.REGISTER}>
                  Boshlash
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
