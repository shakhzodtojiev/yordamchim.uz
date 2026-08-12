import { redirect } from "next/navigation";

import { ApiError } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";

/** Authenticated layer — verifies the session is real before the shell loads. */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await api.me();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      // Route through the cookie-clearing handler — a Server Component can't
      // delete the stale cookies itself, and leaving them triggers a
      // middleware redirect loop between /dashboard and /login.
      redirect("/session/expired");
    }
    // Surface the real cause in container stderr — Next.js otherwise masks
    // these as generic "Server Components render" errors with a digest.
    console.error("[AppLayout] api.me() failed:", error);
    throw error;
  }
  return <>{children}</>;
}
