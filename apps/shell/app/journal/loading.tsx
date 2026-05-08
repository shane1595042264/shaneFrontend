export default function JournalLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-10 space-y-3">
        <div className="h-8 w-48 rounded bg-white/8 animate-pulse" />
        <div className="h-3.5 w-full max-w-xl rounded bg-white/8 animate-pulse" />
        <div className="h-3.5 w-3/4 max-w-md rounded bg-white/8 animate-pulse" />
      </header>

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <div className="h-8 w-40 rounded-md bg-white/8 animate-pulse" />
        <div className="h-8 w-20 rounded-md bg-white/8 animate-pulse" />
      </div>

      <div className="space-y-10">
        {Array.from({ length: 2 }).map((_, sectionIdx) => (
          <section key={sectionIdx}>
            <div className="mb-3 h-3 w-12 rounded bg-white/8 animate-pulse" />
            <ul className="divide-y divide-white/8 rounded-md border border-white/8">
              {Array.from({ length: 5 }).map((_, rowIdx) => (
                <li key={rowIdx} className="px-4 py-3 space-y-2">
                  <div className="flex items-baseline justify-between">
                    <div className="h-4 w-24 rounded bg-white/8 animate-pulse" />
                    <div className="ml-4 flex items-center gap-3">
                      <div className="h-3 w-14 rounded bg-white/8 animate-pulse" />
                      <div className="h-3 w-20 rounded bg-white/8 animate-pulse" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-3 w-full rounded bg-white/8 animate-pulse" />
                    <div className="h-3 w-4/5 rounded bg-white/8 animate-pulse" />
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
