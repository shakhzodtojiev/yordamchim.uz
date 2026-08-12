import { notFound } from "next/navigation";

import { api } from "@/lib/api/endpoints";

/**
 * Server-side gate. Non-admins hit a 404 — this avoids leaking the existence
 * of the admin surface to regular teachers. `can_admin` is True for both the
 * dedicated `is_admin` role and Django superusers; plain `is_staff` is for
 * Django admin (/admin/) only and is intentionally not used here.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await api.me();
  if (!user.can_admin) notFound();
  return <>{children}</>;
}
