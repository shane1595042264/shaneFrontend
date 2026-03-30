"use client";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="text-center space-y-4 max-w-md">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded bg-red-500/20 text-red-400 text-xl font-bold">
          !
        </div>
        <h2 className="text-lg font-semibold text-gray-100">
          Something went wrong
        </h2>
        <p className="text-sm text-gray-400">
          {error.message || "An unexpected error occurred."}
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 text-sm bg-white/10 hover:bg-white/15 text-gray-200 rounded transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
