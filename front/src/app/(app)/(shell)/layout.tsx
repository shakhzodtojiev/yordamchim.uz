import { BottomNav } from "@/components/app-shell/bottom-nav";
import { NavProgress } from "@/components/app-shell/nav-progress";
import { PageTransition } from "@/components/app-shell/page-transition";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { api } from "@/lib/api/endpoints";

export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await api.me();
  // Admin's bottom-nav "Boshqa" button shows a pending-objection badge —
  // fetch the count once at the shell level so every page renders with it.
  // Failures are non-blocking: a stat hiccup shouldn't break navigation.
  let pendingObjections = 0;
  if (user.can_admin) {
    try {
      const stats = await api.admin.stats();
      pendingObjections = stats.objections.pending;
    } catch {
      pendingObjections = 0;
    }
  }
  return (
    <div className="min-h-screen flex">
      <NavProgress />
      <Sidebar canAdmin={user.can_admin} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={user} />
        <main
          data-app-shell="main"
          className="flex-1 p-4 md:p-8 pb-24 md:pb-8"
        >
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <BottomNav
        canAdmin={user.can_admin}
        pendingObjections={pendingObjections}
      />
    </div>
  );
}
