export default function VocabularyLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px] space-y-1">
          <div className="rounded bg-white/8 animate-pulse h-3 w-24" />
          <div className="rounded bg-white/8 animate-pulse h-9 w-full" />
        </div>
        <div className="space-y-1">
          <div className="rounded bg-white/8 animate-pulse h-3 w-16" />
          <div className="rounded bg-white/8 animate-pulse h-9 w-32" />
        </div>
        <div className="rounded bg-white/8 animate-pulse h-5 w-20" />
        <div className="rounded bg-white/8 animate-pulse h-9 w-16" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded bg-white/8 animate-pulse h-9 w-48" />
        <div className="rounded bg-white/8 animate-pulse h-9 w-36" />
        <div className="rounded bg-white/8 animate-pulse h-9 w-32" />
      </div>

      <div className="rounded bg-white/8 animate-pulse h-4 w-16" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="p-4 bg-white/5 border border-white/8 rounded-lg space-y-2"
          >
            <div className="flex items-baseline gap-2">
              <div className="rounded bg-white/8 animate-pulse h-6 w-24" />
              <div className="rounded bg-white/8 animate-pulse h-3 w-12" />
            </div>
            <div className="flex gap-2">
              <div className="rounded bg-white/8 animate-pulse h-5 w-16" />
              <div className="rounded bg-white/8 animate-pulse h-3 w-12" />
            </div>
            <div className="rounded bg-white/8 animate-pulse h-4 w-full" />
            <div className="rounded bg-white/8 animate-pulse h-4 w-3/4" />
            <div className="flex gap-1">
              <div className="rounded bg-white/8 animate-pulse h-4 w-12" />
              <div className="rounded bg-white/8 animate-pulse h-4 w-10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
