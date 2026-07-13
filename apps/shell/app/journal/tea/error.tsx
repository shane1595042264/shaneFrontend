"use client";

import Link from "next/link";

export default function TeaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="text-center space-y-4 max-w-md">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded bg-emerald-500/20 text-emerald-400 text-sm font-bold">
          Te
        </div>
        <h2 className="text-lg font-semibold text-gray-100">
          Tea entries unavailable
        </h2>
        <p className="text-sm text-gray-400">
          {error.message || "Failed to load your tea entries."}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 text-sm bg-white/10 hover:bg-white/15 text-gray-200 rounded transition-colors"
          >
            Retry
          </button>
          <Link
            href="/journal"
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Back to Journal
          </Link>
        </div>
      </div>
    </div>
  );
}
