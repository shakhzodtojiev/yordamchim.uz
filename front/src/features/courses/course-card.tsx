import Link from "next/link";
import { BookOpen, PlayCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Course } from "@/types/api";

export function CourseCard({ item }: { item: Course }) {
  const total = item.lesson_count || 0;
  const done = item.completed_count || 0;
  // Clamp to [0, 100] — radix Progress doesn't clamp and any future annotate
  // regression producing done > total would render the bar overflowing right.
  const pct =
    total > 0 ? Math.min(100, Math.max(0, Math.round((done / total) * 100))) : 0;

  return (
    <Link href={`/courses/${item.id}`} className="group">
      <Card interactive className="overflow-hidden h-full">
        <div className="aspect-video bg-secondary/60 grid place-items-center overflow-hidden">
          {item.cover_image ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={item.cover_image}
              alt={item.title}
              className="h-full w-full object-cover no-select transition-transform duration-300 group-hover:scale-105"
              draggable={false}
            />
          ) : (
            <BookOpen className="h-10 w-10 text-muted-foreground/60" />
          )}
        </div>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <Badge variant="secondary">{item.subject.name}</Badge>
            <Badge variant="outline">{item.grade.name}</Badge>
            {item.quarter ? (
              <Badge variant="outline">{item.quarter}-chorak</Badge>
            ) : null}
          </div>
          <h3 className="font-semibold leading-tight line-clamp-2 group-hover:underline">
            {item.title}
          </h3>
          <div className="space-y-1.5">
            <Progress value={pct} className="h-1.5" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <PlayCircle className="h-3 w-3" />
                {done} / {total} dars
              </span>
              <span className="tabular-nums">{pct}%</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
