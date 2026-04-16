export default function JournalLoading() {
  return (
    <div className="flex min-h-0 h-full">
      {/* Sidebar skeleton */}
      <div className="hidden md:block w-44 flex-shrink-0 border-r border-white/8 p-2 space-y-2">
        <div className="h-5 w-16 rounded bg-white/8 animate-pulse" />
        <div className="ml-2 space-y-1.5">
          <div className="h-4 w-20 rounded bg-white/8 animate-pulse" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-3.5 w-10 ml-2 rounded bg-white/8 animate-pulse" />
          ))}
        </div>
        <div className="h-4 w-20 ml-2 rounded bg-white/8 animate-pulse" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-3.5 w-10 ml-4 rounded bg-white/8 animate-pulse" />
        ))}
      </div>

      {/* Content skeleton */}
      <div className="flex-1 min-w-0 px-4 md:px-8 py-6 max-w-2xl mx-auto space-y-8">
        <div className="h-7 w-20 rounded bg-white/8 animate-pulse" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="h-5 w-32 rounded bg-white/8 animate-pulse" />
            <div className="h-3 w-full rounded bg-white/8 animate-pulse" />
            <div className="h-3 w-5/6 rounded bg-white/8 animate-pulse" />
            <div className="h-3 w-4/6 rounded bg-white/8 animate-pulse" />
            <div className="h-3 w-full rounded bg-white/8 animate-pulse" />
            <div className="h-3 w-3/4 rounded bg-white/8 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Right panel skeleton */}
      <div className="hidden lg:block w-72 flex-shrink-0 border-l border-white/8 p-3 space-y-3">
        <div className="h-4 w-24 rounded bg-white/8 animate-pulse" />
        <div className="border-t border-white/8 pt-3 space-y-2">
          <div className="h-4 w-16 rounded bg-white/8 animate-pulse" />
          <div className="h-3 w-full rounded bg-white/8 animate-pulse" />
          <div className="h-3 w-3/4 rounded bg-white/8 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
