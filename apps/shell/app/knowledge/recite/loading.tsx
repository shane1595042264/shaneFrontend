// Shaped like the first thing /knowledge/recite shows (the "where are you"
// picker), not like the browse grid app/knowledge/loading.tsx would otherwise
// draw here: a skeleton of the wrong page flashes the wrong layout.
export default function ReciteLoading() {
  return (
    <div className="mx-auto max-w-3xl" aria-hidden="true">
      <div className="h-5 w-24 animate-pulse rounded bg-white/[0.06]" />
      <div className="mt-12 h-11 w-72 animate-pulse rounded-lg bg-white/[0.06]" />
      <div className="mt-4 h-5 w-96 max-w-full animate-pulse rounded bg-white/[0.05]" />
      <div className="mt-10 grid gap-2 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[68px] animate-pulse rounded-xl bg-white/[0.04]" />
        ))}
      </div>
    </div>
  );
}
