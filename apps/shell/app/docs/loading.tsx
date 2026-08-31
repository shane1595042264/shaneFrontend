export default function DocsLoading() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 h-8 w-56 animate-pulse rounded bg-white/10" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-lg border border-white/10 bg-white/5"
          />
        ))}
      </div>
    </main>
  );
}
