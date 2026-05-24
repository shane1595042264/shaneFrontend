"use client";

import { useEffect, useState } from "react";
import { deleteTrip } from "@/lib/api/trips";
import { FocusTrappedDiv } from "@/components/focus-trapped-div";

interface Props {
  slug: string;
  title: string | null;
}

export function TripActions({ slug, title }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!confirmOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !deleting) {
        setConfirmOpen(false);
        setError(null);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmOpen, deleting]);

  const onConfirmDelete = async () => {
    setError(null);
    setDeleting(true);
    try {
      await deleteTrip(slug);
      // Hard nav so the index page (force-dynamic + cache:no-store) refetches without the deleted row.
      window.location.href = "/trips";
    } catch (err: any) {
      setError(err?.message ?? "Failed to delete trip");
      setDeleting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { setError(null); setConfirmOpen(true); }}
        disabled={deleting}
        className="text-xs text-gray-500 hover:text-red-400 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        {deleting ? "Deleting…" : "Delete"}
      </button>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => { if (!deleting) { setConfirmOpen(false); setError(null); } }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="trip-delete-heading"
        >
          <FocusTrappedDiv
            className="bg-gray-900 border border-white/10 rounded-lg p-6 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="trip-delete-heading" className="text-lg font-semibold text-white mb-2">
              Delete {title ? `"${title}"` : `trip ${slug}`}?
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              This removes the trip permanently. Trips are public — anyone can delete any trip, including you, and the action cannot be undone.
            </p>
            {error && (
              <p role="alert" className="mb-4 text-sm text-red-400">{error}</p>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setConfirmOpen(false); setError(null); }}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-white/5 hover:bg-white/10 disabled:opacity-50 text-gray-400 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirmDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded transition-colors"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </FocusTrappedDiv>
        </div>
      )}
    </>
  );
}
