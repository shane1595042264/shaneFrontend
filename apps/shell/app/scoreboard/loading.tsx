export default function ScoreboardLoading() {
  return (
    <div
      className="mx-auto max-w-5xl px-4 py-12"
      role="status"
      aria-label="Loading scoreboard"
    >
      <span className="sr-only">Loading scoreboard</span>
      <div className="mb-8 space-y-2">
        <div className="h-8 w-64 rounded bg-white/8 animate-pulse" />
        <div className="h-4 w-80 rounded bg-white/8 animate-pulse" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="h-48 rounded-lg border border-white/10 bg-black/20 animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
