import { redirect } from "next/navigation";

import { CtaSection } from "@/features/landing/cta-section";
import { FeaturesSection } from "@/features/landing/features-section";
import { HeroSection } from "@/features/landing/hero-section";
import { HowSection } from "@/features/landing/how-section";
import { LandingFooter } from "@/features/landing/landing-footer";
import { LandingNav } from "@/features/landing/landing-nav";
import { StatsSection } from "@/features/landing/stats-section";
import { readAccessToken } from "@/lib/api/cookies";
import { ROUTES } from "@/lib/constants";

// Logged-in visitors auto-land on their dashboard, not the marketing page —
// UNLESS they explicitly ask for the landing (`?home=1`, e.g. the admin panel's
// "Bosh sahifa" button), so admins can still view the public page on demand.
export const dynamic = "force-dynamic";

export default function RootPage({
  searchParams,
}: {
  searchParams: { home?: string };
}) {
  const authed = Boolean(readAccessToken());
  if (authed && searchParams.home !== "1") {
    redirect(ROUTES.DASHBOARD);
  }
  return (
    <div className="flex flex-col min-h-screen">
      <LandingNav authed={authed} />
      <main className="flex-1">
        <HeroSection />
        <FeaturesSection />
        <HowSection />
        <StatsSection />
        <CtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
