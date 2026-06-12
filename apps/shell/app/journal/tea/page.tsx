"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { listMyTeaEntries, type TeaEntrySummary } from "@/lib/api/tea-entries";

export default function TeaEntriesIndexPage() {
  const { user, loading: authLoading } = useAuth();
  const [entries, setEntries] = useState<TeaEntrySummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setEntries([]);
      return;
    }
    listMyTeaEntries()
      .then((r) => setEntries(r.entries))
      .catch(() => setError("Could not load your tea entries."));
  }, [authLoading, user]);

  if (authLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12" aria-busy>
        <div className="h-3 w-28 rounded bg-white/8 animate-pulse" />
        <div className="mt-3 h-7 w-44 rounded bg-white/8 animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-sm text-gray-400">
        <Link href="/journal" className="text-gray-500 hover:text-gray-300">← back to journal</Link>
        <p className="mt-4">Sign in to see your tea entries.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/journal" className="text-sm text-gray-500 hover:text-gray-300">← back to journal</Link>
      <header className="mt-4 mb-6 flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <span aria-hidden>🍵</span> My tea entries
        </h1>
        <Link
          href="/journal/tea/new"
          className="ml-auto inline-flex min-h-11 items-center justify-center rounded-md bg-white px-4 text-sm font-medium text-black hover:bg-gray-200"
        >
          New tea entry
        </Link>
      </header>
      <p className="mb-6 text-sm text-gray-400">
        Private posts protected by a 4-digit PIN. Only you see this list.
      </p>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {entries === null ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 w-full rounded border border-white/10 bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No tea entries yet.</p>
      ) : (
        <ul className="divide-y divide-white/8 border-y border-white/8">
          {entries.map((e) => (
            <li key={e.id}>
              <Link
                href={`/journal/tea/${e.id}`}
                className="flex items-center justify-between gap-4 py-4 transition-colors hover:bg-white/[0.03]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base text-white">
                    {e.title?.trim() || <span className="text-gray-500 italic">Untitled tea entry</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {new Date(e.createdAt).toLocaleString()}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-gray-600">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
