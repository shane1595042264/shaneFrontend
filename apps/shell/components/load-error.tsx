"use client";

// SHAN-621: shown in place of a section's empty state when its fetch failed,
// so a failed load never reads as "No active bans." or a budget that is still
// loading. `stale` is set when an older copy is still on screen above it.
export function LoadError({
  message,
  onRetry,
  stale = false,
}: {
  message: string;
  onRetry?: () => void;
  stale?: boolean;
}) {
  return (
    <p role="alert" className="text-sm text-red-400">
      {message}
      {stale && " Showing what was loaded before."}
      {onRetry && (
        <>
          {" "}
          <button
            type="button"
            onClick={onRetry}
            className="text-gray-200 underline decoration-white/30 underline-offset-2 transition-colors hover:text-white"
          >
            Retry
          </button>
        </>
      )}
    </p>
  );
}
