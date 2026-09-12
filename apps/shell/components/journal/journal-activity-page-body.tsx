"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { listActivity, type JournalActivityRow } from "@/lib/api/journal-activity";
import { ActivityList } from "@/components/journal/journal-activity-feed";
import { InlineErrorState } from "@/components/inline-error-state";
import { humanizeError } from "@/lib/humanize-error";

const PAGE_SIZE = 50;

/**
 * Site-wide journal audit trail (SHAN-484). Newest first, cursor-paginated.
 *
 * Loads in an effect rather than a Server Component: the journal is invite-only
 * and the JWT lives in localStorage, so an SSR fetch would carry no
 * Authorization header and always 403 (SHAN-472/475).
 */
export function JournalActivityPageBody() {
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<JournalActivityRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guards the first page against a late-resolving second render overwriting a
  // list the user has already paged past.
  const loadedFor = useRef<string | null>(null);

  const loadFirstPage = useCallback(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    listActivity({ limit: PAGE_SIZE })
      .then((page) => {
        setRows(page.activity);
        setCursor(page.nextCursor);
      })
      .catch((e) => setError(humanizeError(e, "Failed to load activity")))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (loadedFor.current === (user?.id ?? null)) return;
    loadedFor.current = user?.id ?? null;
    loadFirstPage();
  }, [authLoading, user?.id, loadFirstPage]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await listActivity({ limit: PAGE_SIZE, cursor });
      setRows((prev) => [...prev, ...page.activity]);
      setCursor(page.nextCursor);
    } catch (e) {
      setError(humanizeError(e, "Failed to load more activity"));
    } finally {
      setLoadingMore(false);
    }
  };

  const backLink = (
    <Link href="/journal" className="text-sm text-gray-400 hover:text-gray-300">
      ← all entries
    </Link>
  );

  if (authLoading || (user && loading)) {
    return (
      <div aria-busy={true}>
        <div className="mb-2 h-7 w-28 rounded bg-white/8 animate-pulse" />
        <div className="mb-6 h-3 w-80 rounded bg-white/8 animate-pulse" />
        <div role="status" aria-label="Loading activity">
          <span className="sr-only">Loading activity…</span>
          <ul className="divide-y divide-white/10 rounded-md border border-white/10">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="flex items-center gap-2 px-3 py-2">
                <div className="h-5 w-5 rounded-full bg-white/8 animate-pulse" />
                <div className="h-3 w-40 rounded bg-white/8 animate-pulse" />
                <div className="ml-auto h-3 w-10 rounded bg-white/8 animate-pulse" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  // The access gate only renders children for a signed-in member, so this is a
  // defensive branch rather than the usual signed-out path.
  if (!user) {
    return (
      <div className="text-sm text-gray-400">
        {backLink}
        <p className="mt-4">Sign in to view journal activity.</p>
      </div>
    );
  }

  if (error && rows.length === 0) {
    return (
      <InlineErrorState
        message={error}
        onRetry={loadFirstPage}
        backHref="/journal"
        backLabel="Back to journal"
      />
    );
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold">Activity</h1>
      <p className="mb-6 text-sm text-gray-400">
        Every change anyone has made to the journal, newest first. Actions taken by an
        agent on someone&apos;s behalf are tagged with the token that made them.
      </p>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">No activity recorded yet.</p>
      ) : (
        <ActivityList rows={rows} />
      )}

      {error && rows.length > 0 && (
        <p role="alert" className="mt-3 text-xs text-red-400">
          {error}
        </p>
      )}

      {cursor && (
        <div className="mt-4">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="inline-flex min-h-9 items-center justify-center rounded border border-white/20 px-4 text-sm text-gray-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}

      <div className="mt-8">{backLink}</div>
    </div>
  );
}
