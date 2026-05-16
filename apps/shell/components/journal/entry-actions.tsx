"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { deleteEntry } from "@/lib/api/journal";

interface Props {
  date: string;
  authorId: string;
}

export function EntryActions({ date, authorId }: Props) {
  const { user, loading } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const isAuthor = !loading && user && user.id === authorId;

  const onDelete = async () => {
    if (!window.confirm("Delete this entry? This cannot be undone from the UI.")) return;
    setDeleting(true);
    try {
      await deleteEntry(date);
      // Hard nav so Next 15's client router cache doesn't replay the now-trashed entry.
      window.location.href = "/journal";
    } catch (err: any) {
      setDeleting(false);
      window.alert(err?.message ?? "Failed to delete entry");
    }
  };

  return (
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
          onClick={onDelete}
          disabled={deleting}
          className="text-gray-500 hover:text-red-400 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
      )}
    </div>
  );
}
