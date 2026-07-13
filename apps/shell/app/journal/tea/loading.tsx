// Route-segment skeleton for /journal/tea. Renders inside journal/layout.tsx
// (px-3 md:px-6 py-4 md:py-6), so it supplies its own mx-auto max-w-3xl
// container to match tea/page.tsx. Mirrors the tea index chrome: back link,
// header with title + New-entry action, description, PIN-card placeholder,
// and the divide-y list of entry rows.
export default function TeaLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12" aria-busy={true}>
      <div className="h-4 w-32 rounded bg-white/8 animate-pulse" />
      <header className="mt-4 mb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span aria-hidden>🍵</span>
          <div className="h-7 w-44 rounded bg-white/8 animate-pulse" />
        </div>
        <div className="ml-auto h-11 w-36 rounded-md bg-white/8 animate-pulse" />
      </header>

      <div className="mb-6 h-3.5 w-80 max-w-full rounded bg-white/8 animate-pulse" />

      <div className="mb-6 h-24 w-full rounded-md border border-white/10 bg-white/[0.03] animate-pulse" />

      <div className="mb-4 h-10 w-full rounded-md border border-white/10 bg-black/40 animate-pulse" />

      <div
        role="status"
        aria-label="Loading tea entries"
        className="divide-y divide-white/8 border-y border-white/8"
      >
        <span className="sr-only">Loading tea entries…</span>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="py-4">
            <div className="h-4 w-1/2 rounded bg-white/8 animate-pulse" />
            <div className="mt-2 h-3 w-11/12 rounded bg-white/8 animate-pulse" />
            <div className="mt-1.5 h-3 w-28 rounded bg-white/8 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
