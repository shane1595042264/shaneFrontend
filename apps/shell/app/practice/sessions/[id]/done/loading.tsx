export default function SessionDoneLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="h-7 w-52 rounded bg-white/8 animate-pulse" />
      <div className="mt-2 h-4 w-64 rounded bg-white/8 animate-pulse" />

      <ul className="mt-6 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <li
            key={i}
            className="flex items-center justify-between rounded border border-white/10 p-3"
          >
            <div className="h-4 w-2/3 rounded bg-white/8 animate-pulse" />
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-wrap gap-3">
        <div className="h-9 w-36 rounded bg-white/8 animate-pulse" />
        <div className="h-9 w-32 rounded bg-white/8 animate-pulse" />
        <div className="h-9 w-32 rounded bg-white/8 animate-pulse" />
      </div>
    </div>
  );
}
