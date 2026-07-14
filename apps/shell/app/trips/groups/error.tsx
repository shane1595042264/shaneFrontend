"use client";

import Link from "next/link";

export default function GroupsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="text-center space-y-4 max-w-md">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded bg-cyan-500/20 text-cyan-400 text-sm font-bold">
          Gr
        </div>
        <h2 className="text-lg font-semibold text-gray-100">
          Groups unavailable
        </h2>
        <p className="text-sm text-gray-400">
          {error.message || "Failed to load your trip groups."}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 text-sm bg-white/10 hover:bg-white/15 text-gray-200 rounded transition-colors"
          >
            Retry
          </button>
          <Link
            href="/trips/groups"
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Back to groups
          </Link>
          <Link
            href="/trips"
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Back to trips
          </Link>
        </div>
      </div>
    </div>
  );
}
