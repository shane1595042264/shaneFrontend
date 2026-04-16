export default function RngCapitalistLoading() {
  return (
    <div className="space-y-8">
      {/* Budget bar skeleton */}
      <div className="p-4 bg-white/5 border border-white/8 rounded-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-5 w-32 rounded bg-white/8 animate-pulse" />
          <div className="h-8 w-20 rounded bg-white/8 animate-pulse" />
        </div>
        <div className="h-3 w-full rounded bg-white/8 animate-pulse" />
        <div className="flex justify-between">
          <div className="h-4 w-20 rounded bg-white/8 animate-pulse" />
          <div className="h-4 w-24 rounded bg-white/8 animate-pulse" />
        </div>
      </div>

      {/* URL input skeleton */}
      <div className="p-4 bg-white/5 border border-white/8 rounded-lg space-y-3">
        <div className="h-5 w-40 rounded bg-white/8 animate-pulse" />
        <div className="h-10 w-full rounded bg-white/8 animate-pulse" />
        <div className="h-10 w-28 rounded bg-white/8 animate-pulse" />
      </div>

      {/* History + bans grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-3">
          <div className="h-5 w-24 rounded bg-white/8 animate-pulse" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-3 bg-white/5 border border-white/8 rounded-lg space-y-2">
              <div className="h-4 w-40 rounded bg-white/8 animate-pulse" />
              <div className="h-3 w-24 rounded bg-white/8 animate-pulse" />
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <div className="h-5 w-20 rounded bg-white/8 animate-pulse" />
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="p-3 bg-white/5 border border-white/8 rounded-lg">
              <div className="h-4 w-32 rounded bg-white/8 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
