import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminPresentationDetail } from "@/features/presentations/admin-presentation-detail";
import { BuyPanel } from "@/features/presentations/buy-panel";
import { PresentationViewer } from "@/features/presentations/presentation-viewer";
import { ApiError } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";
import { ROUTES } from "@/lib/constants";
import { formatSom } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PresentationDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { preview?: string };
}) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();

  const user = await api.me();
  const isPreview = searchParams.preview === "1";

  // Admin (without ?preview=1) sees the management UI.
  if (user.can_admin && !isPreview) {
    let admin;
    try {
      admin = await api.admin.presentation(id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    }
    const [subjects, grades] = await Promise.all([
      api.subjects(),
      api.grades(),
    ]);
    return (
      <AdminPresentationDetail
        admin={admin}
        subjects={subjects}
        grades={grades}
      />
    );
  }

  // Viewer mode — teachers always, admins via ?preview=1.
  const found = await safePresentation(id);
  if (!found) notFound();
  // notFound() returns `never` at runtime, but the typed signature in the
  // IDE doesn't always carry that — assert non-null to satisfy the checker.
  const presentation = found!;

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href={ROUTES.PRESENTATIONS} aria-label="Orqaga">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {presentation.title}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">{presentation.subject.name}</Badge>
              <Badge variant="outline">{presentation.grade.name}</Badge>
              {presentation.quarter ? (
                <Badge variant="outline">{presentation.quarter}-chorak</Badge>
              ) : null}
              <span className="text-xs text-muted-foreground">
                {presentation.slide_count} slayd
              </span>
              {!presentation.is_official ? (
                presentation.is_owned ? (
                  <Badge variant="success">Sotib olingan</Badge>
                ) : (
                  <Badge>{formatSom(presentation.price)}</Badge>
                )
              ) : null}
              {isPreview ? (
                <Badge variant="outline">Admin preview</Badge>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {presentation.description ? (
        <p className="text-sm text-muted-foreground max-w-3xl">
          {presentation.description}
        </p>
      ) : null}

      {/* Locked = a listed teacher deck not yet bought: show the buy screen
       *  instead of the viewer (backend sends no slide URLs for it). */}
      {presentation.is_locked ? (
        <BuyPanel presentation={presentation} />
      ) : (
        // Admin-uploaded .pptx is rasterised into Slide PNGs server-side; the
        // viewer never sees the original deck, only signed image URLs.
        <PresentationViewer presentation={presentation} />
      )}
    </div>
  );
}

async function safePresentation(id: number) {
  try {
    return await api.presentation(id);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
      return null;
    }
    throw error;
  }
}
