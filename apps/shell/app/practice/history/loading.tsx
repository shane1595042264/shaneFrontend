export default function HistoryLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="h-4 w-12 rounded bg-white/8 animate-pulse" />
      <div className="mt-3 mb-6 h-7 w-40 rounded bg-white/8 animate-pulse" />

      <ul className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <li
            key={i}
            className="rounded border border-white/10 px-3 py-2"
          >
            <div className="h-4 w-3/4 rounded bg-white/8 animate-pulse" />
          </li>
        ))}
      </ul>
    </div>
  );
}
