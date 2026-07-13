// Route-segment skeleton for /journal/inbox. Renders inside journal/layout.tsx
// (px-3 md:px-6 py-4 md:py-6), so it supplies its own mx-auto max-w-3xl
// container to match inbox/page.tsx. Mirrors the grouped-by-date pending
// suggestion list — same shape as the page's own inline loading state.
export default function InboxLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8" aria-busy={true}>
      <div className="mb-2 h-7 w-24 rounded bg-white/8 animate-pulse" />
      <div className="mb-6 h-3 w-72 rounded bg-white/8 animate-pulse" />
      <div role="status" aria-label="Loading inbox" className="space-y-6">
        <span className="sr-only">Loading inbox…</span>
        {Array.from({ length: 2 }).map((_, sectionIdx) => (
          <section key={sectionIdx}>
            <div className="mb-2 h-4 w-28 rounded bg-white/8 animate-pulse" />
            <ul className="divide-y divide-white/10 rounded-md border border-white/10">
              {Array.from({ length: 2 }).map((_, rowIdx) => (
                <li key={rowIdx} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 rounded-full bg-white/8 animate-pulse" />
                      <div className="h-3 w-24 rounded bg-white/8 animate-pulse" />
                    </div>
                    <div className="h-3 w-12 rounded bg-white/8 animate-pulse" />
                  </div>
                  <div className="mt-2 space-y-1.5">
                    <div className="h-3 w-11/12 rounded bg-white/8 animate-pulse" />
                    <div className="h-3 w-3/4 rounded bg-white/8 animate-pulse" />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
