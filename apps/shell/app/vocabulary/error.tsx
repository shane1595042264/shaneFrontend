"use client";

export default function VocabularyError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <p className="text-red-400">Something went wrong loading Vocabulary.</p>
      <p className="text-sm text-gray-500">{error.message}</p>
      <button
        onClick={reset}
        className="px-4 py-2 text-sm bg-white/10 rounded hover:bg-white/20 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
