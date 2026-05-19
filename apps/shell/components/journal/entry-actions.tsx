"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { deleteEntry } from "@/lib/api/journal";
import { FocusTrappedDiv } from "@/components/focus-trapped-div";

interface Props {
  date: string;
  authorId: string;
}

export function EntryActions({ date, authorId }: Props) {
  const { user, loading } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAuthor = !loading && user && user.id === authorId;

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
      await deleteEntry(date);
      // Hard nav so Next 15's client router cache doesn't replay the now-trashed entry.
      window.location.href = "/journal";
    } catch (err: any) {
      setError(err?.message ?? "Failed to delete entry");
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 text-sm">
        <Link
          href={`/journal/${date}/history`}
          className="text-gray-500 hover:text-gray-300 transition-colors"
        >
          History
        </Link>
        {isAuthor && (
          <Link
            href={`/journal/${date}/append`}
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            Append
          </Link>
        )}
        {!loading && user && user.id !== authorId && (
          <Link
            href={`/journal/${date}/suggest`}
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            Suggest edit
          </Link>
        )}
        {isAuthor && (
          <button
            type="button"
            onClick={() => { setError(null); setConfirmOpen(true); }}
            disabled={deleting}
            className="text-gray-500 hover:text-red-400 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        )}
      </div>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => { if (!deleting) { setConfirmOpen(false); setError(null); } }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="entry-delete-heading"
        >
          <FocusTrappedDiv
            className="bg-gray-900 border border-white/10 rounded-lg p-6 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="entry-delete-heading" className="text-lg font-semibold text-white mb-2">
              Delete entry for {date}?
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              This removes the entry plus all its versions, appends, comments, and reactions. This cannot be undone.
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
