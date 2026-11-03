"use client";

import { routeErrorMessage } from "@/lib/humanize-error";
import { useRouteRetry } from "@/lib/use-route-retry";

export default function CoursesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const retry = useRouteRetry(reset);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="rounded border border-gray-600 bg-gray-900/60 px-2 py-1 font-mono text-sm text-gray-400">
        Co
      </span>
      <p className="text-sm text-gray-400">
        {routeErrorMessage(error, "The course catalog failed to load.")}
      </p>
      <div className="flex gap-3">
        <button
          onClick={retry}
          className="min-h-11 rounded-md bg-white px-4 text-sm font-medium text-black hover:bg-gray-200"
        >
          Retry
        </button>
        <a
          href="/"
          className="flex min-h-11 items-center rounded-md bg-white/10 px-4 text-sm text-gray-200 hover:bg-white/20"
        >
          Back to Table
        </a>
      </div>
    </div>
  );
}
