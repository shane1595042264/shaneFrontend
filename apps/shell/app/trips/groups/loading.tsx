export default function GroupsLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="h-3.5 w-24 rounded bg-white/8 animate-pulse" />

      <header className="mt-3 mb-8 flex flex-wrap items-baseline justify-between gap-3">
        <div className="space-y-3">
          <div className="h-8 w-56 rounded bg-white/8 animate-pulse" />
          <div className="h-3.5 w-full max-w-md rounded bg-white/8 animate-pulse" />
        </div>
        <div className="h-11 w-32 rounded-md bg-white/8 animate-pulse" />
      </header>

      <section className="mb-10 rounded-md border border-white/10 bg-black/20 p-4 space-y-3">
        <div className="h-3.5 w-40 rounded bg-white/8 animate-pulse" />
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="h-11 flex-1 rounded bg-white/8 animate-pulse" />
          <div className="h-11 w-20 rounded bg-white/8 animate-pulse" />
        </div>
      </section>

      <ul className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <li
            key={i}
            className="rounded-md border border-white/10 bg-black/20 p-4 space-y-2"
          >
            <div className="h-5 w-3/4 rounded bg-white/8 animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-white/8 animate-pulse" />
            <div className="h-3 w-2/3 rounded bg-white/8 animate-pulse" />
          </li>
        ))}
      </ul>
    </div>
  );
}
