import Link from "next/link";
import { Eye } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { AdminPresentation } from "@/types/api";

export function AdminPresentationsList({
  items,
}: {
  items: AdminPresentation[];
}) {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Hali taqdimotlar yo'q. "Yangi taqdimot" tugmasi orqali boshlang.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Mobile: card stack */}
      <div className="md:hidden space-y-3">
        {items.map((p) => (
          <Link key={p.id} href={`/presentations/${p.id}`} className="block">
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-medium leading-tight">{p.title}</div>
                  {p.is_published ? (
                    <Badge variant="success">Chop etilgan</Badge>
                  ) : (
                    <Badge variant="outline">Qoralama</Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary">{p.subject.name}</Badge>
                  <Badge variant="outline">{p.grade.name}</Badge>
                  {p.quarter ? (
                    <Badge variant="outline">{p.quarter}-chorak</Badge>
                  ) : null}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
                  <span>{p.slide_count} slayd</span>
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {p.view_count}
                  </span>
                  <span>
                    {new Date(p.created_at).toLocaleDateString("uz-UZ")}
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Desktop: table */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-muted-foreground">
                    Sarlavha
                  </th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-muted-foreground">
                    Fan / Sinf
                  </th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-muted-foreground text-right">
                    Slaydlar
                  </th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-muted-foreground text-right">
                    Ko'rishlar
                  </th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-muted-foreground">
                    Holat
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((p) => (
                  <tr key={p.id} className="hover:bg-accent/30">
                    <td className="px-4 py-3">
                      <Link
                        href={`/presentations/${p.id}`}
                        className="font-medium hover:underline"
                      >
                        {p.title}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString("uz-UZ")}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        <Badge variant="secondary">{p.subject.name}</Badge>
                        <Badge variant="outline">{p.grade.name}</Badge>
                        {p.quarter ? (
                          <Badge variant="outline">{p.quarter}-chorak</Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {p.slide_count}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {p.view_count}
                    </td>
                    <td className="px-4 py-3">
                      {p.is_published ? (
                        <Badge variant="success">Chop etilgan</Badge>
                      ) : (
                        <Badge variant="outline">Qoralama</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
