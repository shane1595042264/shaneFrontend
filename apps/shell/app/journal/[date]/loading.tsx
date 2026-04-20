export default function JournalEntryLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-6">
      {/* Back link placeholder */}
      <div className="h-3.5 w-24 rounded bg-white/8 animate-pulse mb-6" />

      {/* Date header */}
      <div className="h-7 w-56 rounded bg-white/8 animate-pulse mb-6" />

      {/* Article paragraphs */}
      <div className="space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2.5">
            <div className="h-3 w-full rounded bg-white/8 animate-pulse" />
            <div className="h-3 w-5/6 rounded bg-white/8 animate-pulse" />
            <div className="h-3 w-4/6 rounded bg-white/8 animate-pulse" />
            <div className="h-3 w-full rounded bg-white/8 animate-pulse" />
            <div className="h-3 w-3/4 rounded bg-white/8 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Prev / Next nav placeholder */}
      <nav className="flex items-center justify-between mt-10 pt-6 border-t border-white/8">
        <div className="h-3.5 w-16 rounded bg-white/8 animate-pulse" />
        <div className="h-3.5 w-16 rounded bg-white/8 animate-pulse" />
      </nav>
    </div>
  );
}
