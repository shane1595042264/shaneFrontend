// skincare/layout.tsx is a passthrough, so this skeleton renders the page's
// own full-page container (mx-auto max-w-5xl px-4 py-12) with the Skincare
// header and the two-column routine grid from skincare/page.tsx.
export default function SkincareLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-3">
        <div className="space-y-2">
          <div className="h-8 w-40 rounded bg-white/8 animate-pulse" />
          <div className="h-3 w-72 rounded bg-white/8 animate-pulse" />
        </div>
        <div className="h-4 w-16 rounded bg-white/8 animate-pulse" />
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, col) => (
          <section
            key={col}
            className="rounded-lg border border-white/10 bg-black/20 p-4"
          >
            <div className="mb-4 flex items-baseline justify-between gap-2">
              <div className="h-5 w-28 rounded bg-white/8 animate-pulse" />
              <div className="h-3 w-16 rounded bg-white/8 animate-pulse" />
            </div>
            <ul className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 rounded-md border border-white/10 bg-black/20 px-3 py-3"
                >
                  <div className="h-12 w-12 shrink-0 rounded bg-white/8 animate-pulse" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-4 w-36 rounded bg-white/8 animate-pulse" />
                    <div className="h-3 w-24 rounded bg-white/8 animate-pulse" />
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
