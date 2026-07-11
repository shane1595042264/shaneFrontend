export default function PracticeLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-3">
        <div className="space-y-3">
          <div className="h-8 w-32 rounded bg-white/8 animate-pulse" />
          <div className="h-3.5 w-56 rounded bg-white/8 animate-pulse" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="h-11 w-24 rounded-md bg-white/8 animate-pulse" />
          <div className="h-11 w-36 rounded-md bg-white/8 animate-pulse" />
        </div>
      </header>

      <div className="mb-4 h-4 w-32 rounded bg-white/8 animate-pulse" />

      <ul className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <li
            key={i}
            className="rounded-md border border-white/10 bg-black/20 p-4 space-y-2"
          >
            <div className="h-5 w-3/4 rounded bg-white/8 animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-white/8 animate-pulse" />
            <div className="h-3 w-2/3 rounded bg-white/8 animate-pulse" />
            <div className="h-3 w-1/3 rounded bg-white/8 animate-pulse" />
          </li>
        ))}
      </ul>
    </div>
  );
}
