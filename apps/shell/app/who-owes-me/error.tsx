"use client";

import Link from "next/link";

export default function WhoOwesMeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="text-center space-y-4 max-w-md">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded bg-amber-500/20 text-amber-400 text-sm font-bold">
          Wm
        </div>
        <h2 className="text-lg font-semibold text-gray-100">
          Who Owes Me unavailable
        </h2>
        <p className="text-sm text-gray-400">
          {error.message || "Failed to load your ledger."}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 text-sm bg-white/10 hover:bg-white/15 text-gray-200 rounded transition-colors"
          >
            Retry
          </button>
          <Link
            href="/"
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Back to Table
          </Link>
        </div>
      </div>
    </div>
  );
}
