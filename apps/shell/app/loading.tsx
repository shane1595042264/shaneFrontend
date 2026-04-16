export default function HomeLoading() {
  return (
    <div className="flex flex-col items-center justify-center px-2 py-6 sm:px-4 sm:py-10 md:px-6 md:py-16 gap-4 sm:gap-6 md:gap-10">
      <div className="text-center">
        <div className="h-7 sm:h-8 md:h-10 w-64 sm:w-72 md:w-96 rounded bg-white/8 animate-pulse mx-auto mb-1 sm:mb-2" />
        <div className="h-4 w-48 sm:w-56 rounded bg-white/8 animate-pulse mx-auto" />
      </div>
      <div className="w-full max-w-6xl">
        <div className="grid grid-cols-6 sm:grid-cols-9 md:grid-cols-12 lg:grid-cols-18 gap-1.5 sm:gap-2">
          {Array.from({ length: 36 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-md bg-white/5 border border-white/8 animate-pulse"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
