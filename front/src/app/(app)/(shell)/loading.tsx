import { Skeleton } from "@/components/ui/skeleton";

// Generic in-shell fallback. Per-route loading.tsx files override this with
// content-shaped skeletons; this catches anything that doesn't have one.
export default function ShellLoading() {
  return (
    <div className="space-y-6 max-w-6xl">
      <Skeleton className="h-32 w-full rounded-2xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
