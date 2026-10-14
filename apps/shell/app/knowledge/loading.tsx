// Mirrors KnowledgeSkeleton in components/knowledge/knowledge-browser.tsx, which
// mirrors the page: the one-line composer beside Recite (SHAN-576), the filter
// row, the count, then the grid. Change the page's shape and change both.
export default function KnowledgeLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <div className="h-12 flex-1 animate-pulse rounded-xl bg-white/[0.05]" />
        <div className="h-12 w-full animate-pulse rounded-full bg-white/[0.08] sm:w-28" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-20 animate-pulse rounded-full bg-white/[0.05]" />
          ))}
        </div>
        <div className="h-8 w-44 animate-pulse rounded-lg bg-white/[0.05]" />
      </div>

      <div className="h-4 w-16 animate-pulse rounded bg-white/[0.05]" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
            <div className="flex items-baseline gap-2">
              <div className="h-6 w-24 animate-pulse rounded bg-white/[0.06]" />
              <div className="h-3 w-12 animate-pulse rounded bg-white/[0.06]" />
            </div>
            <div className="h-3 w-20 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-4 w-full animate-pulse rounded bg-white/[0.06]" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-white/[0.06]" />
          </div>
        ))}
      </div>
    </div>
  );
}
