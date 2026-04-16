export default function KnowledgeLoading() {
  return (
    <div className="space-y-6">
      {/* Note input skeleton */}
      <div className="rounded bg-white/8 animate-pulse h-24 w-full" />

      {/* Category tabs + search skeleton */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded bg-white/8 animate-pulse h-8 w-20" />
          ))}
        </div>
        <div className="rounded bg-white/8 animate-pulse h-8 w-40" />
      </div>

      {/* Count skeleton */}
      <div className="rounded bg-white/8 animate-pulse h-4 w-16" />

      {/* Card grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="p-4 bg-white/5 border border-white/8 rounded-lg space-y-3"
          >
            <div className="flex items-baseline gap-2">
              <div className="rounded bg-white/8 animate-pulse h-6 w-24" />
              <div className="rounded bg-white/8 animate-pulse h-3 w-12" />
            </div>
            <div className="flex gap-2">
              <div className="rounded bg-white/8 animate-pulse h-5 w-16" />
              <div className="rounded bg-white/8 animate-pulse h-5 w-14" />
            </div>
            <div className="rounded bg-white/8 animate-pulse h-4 w-full" />
            <div className="rounded bg-white/8 animate-pulse h-4 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
