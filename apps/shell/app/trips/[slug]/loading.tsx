export default function TripDetailLoading() {
  return (
    <div className="min-h-screen bg-black">
      <header className="border-b border-white/10 bg-black px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-3.5 w-16 rounded bg-white/8 animate-pulse" />
            <span className="text-gray-600">/</span>
            <div className="h-3.5 w-48 rounded bg-white/8 animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-3 w-40 rounded bg-white/8 animate-pulse" />
            <div className="h-3 w-12 rounded bg-white/8 animate-pulse" />
          </div>
        </div>
      </header>

      <div className="h-[calc(100vh-49px)] w-full bg-white/8 animate-pulse" />
    </div>
  );
}
