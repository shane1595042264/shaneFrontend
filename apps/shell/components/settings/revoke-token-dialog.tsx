"use client";

import { FocusTrappedDiv } from "@/components/focus-trapped-div";
import type { ApiToken } from "@/lib/api/tokens";
import { useEscapeKey } from "@/lib/use-escape-key";
import { useScrollLock } from "@/lib/use-scroll-lock";

export function RevokeTokenDialog({
  token,
  revoking,
  error,
  onCancel,
  onConfirm,
}: {
  token: ApiToken;
  revoking: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useScrollLock();
  useEscapeKey(onCancel, !revoking);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={() => {
        if (!revoking) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pat-revoke-heading"
      aria-describedby="pat-revoke-description"
    >
      <FocusTrappedDiv
        className="w-full max-w-sm rounded-lg border border-white/15 bg-gray-950 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="pat-revoke-heading" className="text-lg font-semibold text-white">
          Revoke &ldquo;{token.name}&rdquo;?
        </h3>
        <p id="pat-revoke-description" className="mt-2 text-sm text-gray-400">
          Anything still using this token starts failing immediately. This cannot be undone.
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-400">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={revoking}
            className="min-h-11 rounded-md bg-white/10 px-4 text-sm text-gray-200 transition-colors hover:bg-white/20 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={revoking}
            className="min-h-11 rounded-md bg-red-600 px-4 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {revoking ? "Revoking…" : "Revoke token"}
          </button>
        </div>
      </FocusTrappedDiv>
    </div>
  );
}
