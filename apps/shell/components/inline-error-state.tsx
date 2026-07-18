"use client";

import Link from "next/link";

/**
 * Recovery UI for client-fetch pages whose initial data load fails.
 *
 * Client components can't use Next's error.tsx boundary for their own
 * `fetch().catch()` failures, so pages that early-return an error message would
 * otherwise strand the user with unrecoverable red text. This mirrors the
 * Retry + Back affordance in the route-level error.tsx files so both paths feel
 * the same. Pass `onRetry` to re-run the loader in place (no full reload) and
 * `backHref` for an escape hatch.
 */
export function InlineErrorState({
  message,
  onRetry,
  backHref,
  backLabel = "Back",
}: {
  message: string;
  onRetry?: () => void;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-4">
      <div role="alert" className="text-center space-y-4 max-w-md">
        <h2 className="text-lg font-semibold text-gray-100">
          Something went wrong
        </h2>
        <p className="text-sm text-red-400">{message}</p>
        <div className="flex items-center justify-center gap-3">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-4 py-2 text-sm bg-white/10 hover:bg-white/15 text-gray-200 rounded transition-colors"
            >
              Retry
            </button>
          )}
          {backHref && (
            <Link
              href={backHref}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              {backLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
