// Skeleton must reproduce the page's own container (the layout is a
// passthrough) - same rule as app/skincare/loading.tsx.
export default function CoursesLoading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 h-8 w-44 animate-pulse rounded bg-white/10" />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-lg border border-white/10">
            <div className="aspect-video animate-pulse bg-white/10" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-3/4 animate-pulse rounded bg-white/10" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-white/10" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
