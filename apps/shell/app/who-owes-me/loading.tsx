// Renders inside who-owes-me/layout.tsx <main> (max-w-4xl mx-auto px-6 py-8),
// so this skeleton is content-only — no nav or container wrapper. Mirrors the
// two summary total cards over the loan list in who-owes-me/page.tsx.
export default function WhoOwesMeLoading() {
  return (
    <div className="space-y-8">
      <section className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-white/10 bg-black/20 px-5 py-4 space-y-2"
          >
            <div className="h-3 w-24 rounded bg-white/8 animate-pulse" />
            <div className="h-7 w-32 rounded bg-white/8 animate-pulse" />
            <div className="h-3 w-20 rounded bg-white/8 animate-pulse" />
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <div className="h-4 w-28 rounded bg-white/8 animate-pulse" />
        <ul className="divide-y divide-white/5 border border-white/10 rounded-lg overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="flex items-center justify-between px-4 py-3">
              <div className="space-y-2">
                <div className="h-4 w-40 rounded bg-white/8 animate-pulse" />
                <div className="h-3 w-24 rounded bg-white/8 animate-pulse" />
              </div>
              <div className="h-5 w-20 rounded bg-white/8 animate-pulse" />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
