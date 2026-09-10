// Route-segment skeleton for /journal/access. Renders inside journal/layout.tsx,
// so it supplies its own container to match page.tsx. Mirrors the two-section
// shape of the real page (pending queue, then members).
export default function JournalAccessLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8" aria-busy={true}>
      <div className="mb-2 h-7 w-40 rounded bg-white/8 animate-pulse" />
      <div className="mb-6 h-3 w-80 rounded bg-white/8 animate-pulse" />
      <div role="status" aria-label="Loading journal access" className="space-y-6">
        <span className="sr-only">Loading journal access…</span>
        {Array.from({ length: 2 }).map((_, sectionIdx) => (
          <section key={sectionIdx}>
            <div className="mb-2 h-4 w-32 rounded bg-white/8 animate-pulse" />
            <ul className="divide-y divide-white/10 rounded-md border border-white/10">
              {Array.from({ length: 2 }).map((_, rowIdx) => (
                <li key={rowIdx} className="flex items-center justify-between gap-3 p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-white/8 animate-pulse" />
                    <div className="space-y-1.5">
                      <div className="h-3 w-28 rounded bg-white/8 animate-pulse" />
                      <div className="h-3 w-40 rounded bg-white/8 animate-pulse" />
                    </div>
                  </div>
                  <div className="h-8 w-24 rounded bg-white/8 animate-pulse" />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
