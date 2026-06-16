"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { listMyTeaEntries, teaEntryWasEdited, type TeaEntrySummary } from "@/lib/api/tea-entries";
import { toPlainExcerpt } from "@/lib/journal-text";
import { LoginButton } from "@/components/login-button";
import {
  getTodayInTimezone,
  monthLongLabel,
  relativeDayLabel,
  resolveViewerTimezone,
  weekdayLongLabel,
  weekdayShortLabel,
} from "@/lib/timezone";

const EXCERPT_LEN = 140;

// YYYY-MM-DD for an ISO timestamp in the given timezone. The row renders
// createdAt via toLocaleString so the calendar day the user reads matches
// their local TZ; the search haystack has to follow the same TZ or queries
// like "Friday" or "yesterday" would land on the wrong day at the date line.
function getEntryDate(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export default function TeaEntriesIndexPage() {
  const { user, loading: authLoading } = useAuth();
  const [entries, setEntries] = useState<TeaEntrySummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const viewerTz = useMemo(() => resolveViewerTimezone(user), [user]);
  const today = useMemo(() => getTodayInTimezone(viewerTz), [viewerTz]);

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

  const filtered = useMemo(() => {
    if (entries === null) return null;
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => {
      // Mirror what the row renders so what the eye sees is searchable —
      // SHAN-300 introduced this pattern on the journal index.
      const date = getEntryDate(e.createdAt, viewerTz);
      const haystack = [
        (e.title ?? "").toLowerCase(),
        e.contentExcerpt ? toPlainExcerpt(e.contentExcerpt, EXCERPT_LEN).toLowerCase() : "",
        date,
        weekdayShortLabel(date).toLowerCase(),
        weekdayLongLabel(date).toLowerCase(),
        monthLongLabel(date).toLowerCase(),
        (relativeDayLabel(date, today) ?? "").toLowerCase(),
      ].join(" ");
      return haystack.includes(q);
    });
  }, [entries, deferredQuery, viewerTz, today]);

  const isFiltering = deferredQuery.trim().length > 0;

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
        <div className="mt-3">
          <LoginButton />
        </div>
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

      {entries !== null && entries.length > 0 && (
        <div className="mb-4">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your tea entries"
            aria-label="Search tea entries"
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-white/30 focus:outline-none"
          />
          {isFiltering && filtered !== null && (
            <p className="mt-2 text-xs text-gray-500" aria-live="polite">
              Showing {filtered.length} of {entries.length}{" "}
              {entries.length === 1 ? "entry" : "entries"}
            </p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {entries === null ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 w-full rounded border border-white/10 bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No tea entries yet.</p>
      ) : filtered && filtered.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No matches.</p>
      ) : (
        <ul className="divide-y divide-white/8 border-y border-white/8">
          {(filtered ?? entries).map((e) => {
            const excerpt = e.contentExcerpt ? toPlainExcerpt(e.contentExcerpt, EXCERPT_LEN) : "";
            const edited = teaEntryWasEdited(e);
            return (
              <li key={e.id}>
                <Link
                  href={`/journal/tea/${e.id}`}
                  className="flex items-start justify-between gap-4 py-4 transition-colors hover:bg-white/[0.03]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-base text-white">
                      <span className="truncate">
                        {e.title?.trim() || <span className="text-gray-500 italic">Untitled tea entry</span>}
                      </span>
                      {edited && (
                        <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
                          edited
                        </span>
                      )}
                    </p>
                    {excerpt && (
                      <p className="mt-1 line-clamp-2 text-sm text-gray-400">
                        {excerpt}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      {new Date(e.createdAt).toLocaleString()}
                      {edited && (
                        <>
                          <span aria-hidden> · </span>
                          <span>edited {new Date(e.updatedAt).toLocaleString()}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <span className="mt-1 shrink-0 text-xs text-gray-600">→</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
