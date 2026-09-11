// Skeleton reproduces the page's own container and rail-plus-masonry split
// (the layout is a passthrough) — same rule as app/courses/loading.tsx.
const TILE_HEIGHTS = [180, 240, 150, 210, 280, 170];

export default function BlogLoading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 border-b border-white/10 pb-6">
        <div className="h-8 w-28 animate-pulse rounded bg-white/10" />
        <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-white/10" />
      </div>
      <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
        <div className="space-y-2 lg:w-52 lg:shrink-0">
          <div className="h-11 w-full animate-pulse rounded-md bg-white/10" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 w-full animate-pulse rounded bg-white/[0.06]" />
          ))}
        </div>
        <div className="min-w-0 flex-1 columns-1 gap-5 sm:columns-2 xl:columns-3">
          {TILE_HEIGHTS.map((h, i) => (
            <div
              key={i}
              style={{ height: h }}
              className="mb-5 animate-pulse break-inside-avoid rounded-lg border border-white/10 bg-white/[0.04]"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
