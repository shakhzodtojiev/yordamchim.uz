import Link from "next/link";
import { Eye, FileText, Lock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatSom } from "@/lib/utils";
import type { Presentation } from "@/types/api";

export function PresentationCard({ item }: { item: Presentation }) {
  return (
    <Link href={`/presentations/${item.id}`} className="group">
      <Card interactive className="overflow-hidden h-full">
        <div className="relative aspect-video bg-secondary/60 grid place-items-center overflow-hidden">
          {item.cover_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.cover_image}
              alt={item.title}
              className="h-full w-full object-cover no-select transition-transform duration-300 group-hover:scale-105"
              draggable={false}
            />
          ) : (
            <FileText className="h-10 w-10 text-muted-foreground/60" />
          )}
          {/* Ownership/pricing corner tag — only for paid (teacher) decks. */}
          {!item.is_official ? (
            <div className="absolute top-2 right-2">
              {item.is_owned ? (
                <Badge variant="success">Sizniki</Badge>
              ) : (
                <Badge className="font-semibold shadow-sm">
                  {formatSom(item.price)}
                </Badge>
              )}
            </div>
          ) : null}
        </div>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            <Badge variant="secondary">{item.subject.name}</Badge>
            <Badge variant="outline">{item.grade.name}</Badge>
            {item.quarter ? (
              <Badge variant="outline">{item.quarter}-chorak</Badge>
            ) : null}
          </div>
          <h3 className="font-semibold leading-tight line-clamp-2 group-hover:underline">
            {item.title}
          </h3>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{item.slide_count} slayd</span>
            <span className="inline-flex items-center gap-2">
              {!item.is_official && !item.is_owned ? (
                <span className="inline-flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {item.view_count}
              </span>
            </span>
          </div>
          {item.author_name ? (
            <p className="text-[11px] text-muted-foreground truncate">
              Muallif: {item.author_name}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}

export function PresentationCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="aspect-video bg-muted animate-pulse" />
      <CardContent className="p-4 space-y-2">
        <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
        <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
      </CardContent>
    </Card>
  );
}
