"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toPlainExcerpt } from "@/lib/journal-text";
import { useAuth } from "@/lib/auth-context";
import { listEntries as apiListEntries, type JournalEntry as ApiJournalEntry } from "@/lib/api/journal";
import {
  getTodayInTimezone,
  monthLongLabel,
  relativeDayLabel,
  resolveViewerTimezone,
  timezoneTagFor,
  weekdayLongLabel,
  weekdayShortLabel,
} from "@/lib/timezone";

const EXCERPT_LEN = 200;

interface JournalEntry {
  id: string;
  date: string;
  authorId: string;
  authorTimezone?: string | null;
  author: { id: string; name: string | null; avatarUrl: string | null } | null;
  status: "published" | "trashed";
  editCount: number;
  pendingSuggestionCount: number;
  commentCount: number;
  appendCount: number;
  currentVersionId: string | null;
  contentExcerpt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface YearGroup {
  year: string;
  entries: JournalEntry[];
}

function groupByYear(entries: JournalEntry[]): YearGroup[] {
  const map = new Map<string, JournalEntry[]>();
  for (const e of entries) {
    const year = e.date.slice(0, 4);
    if (!map.has(year)) map.set(year, []);
    map.get(year)!.push(e);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, list]) => ({ year, entries: list }));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightMatches(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const re = new RegExp(`(${escapeRegex(query)})`, "ig");
  const parts = text.split(re);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="rounded-sm bg-yellow-300/70 px-0.5 text-inherit dark:bg-yellow-500/40">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

interface Props {
  entries: JournalEntry[];
  /** Server-side guess used until the client mounts (avoids hydration mismatch). */
  today: string;
  /**
   * True when the ISR seed fetch on the server failed (backend blip during a cold
   * cache). The list is then likely empty not because there are no entries, but
   * because we couldn't load them — so the client self-heals with a fresh fetch.
   */
  initialLoadFailed?: boolean;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

export function JournalSearchList({ entries: seedEntries, today: ssrToday, initialLoadFailed = false }: Props) {
  const { user } = useAuth();

  // Self-heal: when the server-side seed failed (initialLoadFailed) the seed list
  // is unreliable, so re-fetch fresh entries on the client. This bypasses the stale
  // ISR snapshot that would otherwise show an empty/failed page for the full 300s
  // revalidate window, and recovers the moment the backend is healthy again.
  const [recovered, setRecovered] = useState<JournalEntry[] | null>(null);
  const [recoveryState, setRecoveryState] = useState<"idle" | "loading" | "failed">(
    initialLoadFailed && seedEntries.length === 0 ? "loading" : "idle"
  );

  const runRecovery = useCallback(async () => {
    setRecoveryState("loading");
    try {
      const acc: JournalEntry[] = [];
      let cursor: string | undefined;
      while (acc.length < 5000) {
        const page = await apiListEntries({ limit: 100, cursor });
        acc.push(...(page.entries as unknown as JournalEntry[]));
        if (!page.nextCursor) break;
        cursor = page.nextCursor;
      }
      setRecovered(acc);
      setRecoveryState("idle");
    } catch {
      setRecoveryState("failed");
    }
  }, []);

  useEffect(() => {
    if (initialLoadFailed && seedEntries.length === 0) {
      void runRecovery();
    }
    // Only fire off the initial seed state; retries go through the button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Everything downstream reads the recovered list once it lands, else the seed.
  const entries = recovered ?? seedEntries;
  // Use SSR today on first paint, then swap to the viewer's TZ once auth-context
  // resolves. Avoids a hydration mismatch warning while still respecting per-user TZ.
  const viewerTz = useMemo(() => resolveViewerTimezone(user), [user]);
  const [today, setToday] = useState(ssrToday);
  useEffect(() => {
    setToday(getTodayInTimezone(viewerTz));
  }, [viewerTz]);

  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const trimmed = deferredQuery.trim();
  const inputRef = useRef<HTMLInputElement>(null);

  // The client-side haystack only sees contentExcerpt, which the backend caps at
  // the first 500 chars of (body + appends). So a keyword buried deeper in a long
  // entry won't match locally. We additionally run the backend full-text q search
  // (SHAN-329 — ILIKE over the entire current body AND every append) and union its
  // matches in. serverMatches is keyed to the query that produced it; null means
  // "no server result yet for the current query".
  const [serverMatches, setServerMatches] = useState<ApiJournalEntry[] | null>(null);
  const [serverSearching, setServerSearching] = useState(false);

  useEffect(() => {
    if (!trimmed) {
      setServerMatches(null);
      setServerSearching(false);
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    setServerSearching(true);
    const timer = setTimeout(async () => {
      try {
        const acc: ApiJournalEntry[] = [];
        let cursor: string | undefined;
        // Drain cursor pages so deep matches past the first 100 rows still surface.
        while (acc.length < 5000) {
          const page = await apiListEntries(
            { q: trimmed, limit: 100, cursor },
            { signal: controller.signal }
          );
          acc.push(...page.entries);
          if (!page.nextCursor) break;
          cursor = page.nextCursor;
        }
        if (!cancelled) {
          setServerMatches(acc);
          setServerSearching(false);
        }
      } catch (err) {
        // Aborted (stale query) — a newer effect owns the spinner now, so leave it.
        if (cancelled || (err instanceof DOMException && err.name === "AbortError")) return;
        // Real failure: fall back to client-only results, just stop the spinner.
        setServerSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [trimmed]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (isEditableTarget(e.target)) return;
        e.preventDefault();
        const el = inputRef.current;
        if (el) {
          el.focus();
          el.select();
        }
        return;
      }
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        e.preventDefault();
        setQuery("");
        inputRef.current?.blur();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Strip markdown from the search corpus so pasted-image URLs (e.g. ![image.png](https://.../images/<uuid>)) don't false-match queries like "png" or "railway".
  const searchCorpus = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of entries) {
      map.set(e.id, toPlainExcerpt(e.contentExcerpt ?? "", 10_000).toLowerCase());
    }
    return map;
  }, [entries]);

  const filtered = useMemo(() => {
    if (!trimmed) return entries;
    const needle = trimmed.toLowerCase();
    const clientMatched = entries.filter((e) => {
      // Haystack mirrors what the row renders, so what the eye sees is searchable.
      const haystack = [
        e.date,
        weekdayShortLabel(e.date).toLowerCase(),
        weekdayLongLabel(e.date).toLowerCase(),
        monthLongLabel(e.date).toLowerCase(),
        (relativeDayLabel(e.date, today) ?? "").toLowerCase(),
        searchCorpus.get(e.id) ?? "",
        (e.author?.name ?? "").toLowerCase(),
      ].join(" ");
      return haystack.includes(needle);
    });
    if (!serverMatches) return clientMatched;
    // Union in backend full-text matches (deep content the 500-char excerpt missed).
    // Keep the already-loaded entry object for stable metadata/labels, but adopt the
    // server object's match-centered contentExcerpt (SHAN-331): the local excerpt is
    // only the generic first 500 chars, so for a deep match it wouldn't contain the
    // matched term and highlightMatches would show nothing. Fall back entirely to the
    // server object for rows past the index's 5000-entry load cap.
    const byId = new Map(clientMatched.map((e) => [e.id, e]));
    const localById = new Map(entries.map((e) => [e.id, e]));
    for (const s of serverMatches) {
      if (byId.has(s.id)) continue;
      const local = localById.get(s.id);
      byId.set(
        s.id,
        local
          ? { ...local, contentExcerpt: s.contentExcerpt ?? local.contentExcerpt }
          : (s as unknown as JournalEntry)
      );
    }
    return [...byId.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, searchCorpus, today, trimmed, serverMatches]);

  const grouped = useMemo(() => groupByYear(filtered), [filtered]);
  const isFiltering = trimmed.length > 0;
  const todayHasEntry = useMemo(
    () => entries.some((e) => e.date === today),
    [entries, today]
  );
  const todayYear = today.slice(0, 4);
  // Surface the today-placeholder row only on the unfiltered list, so search
  // results stay strictly about matches. Suppress it while recovering/failed so
  // "be the first to write" doesn't masquerade for entries we simply couldn't load.
  const showTodayPlaceholder = !isFiltering && !todayHasEntry && recoveryState === "idle";

  return (
    <div>
      <div className="mb-6">
        <label htmlFor="journal-search" className="sr-only">
          Search journal entries
        </label>
        <div className="relative">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3-3" />
          </svg>
          <input
            ref={inputRef}
            id="journal-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by keyword, date, or author…"
            autoComplete="off"
            className="block min-h-11 w-full rounded-md border border-white/15 bg-transparent pl-9 pr-10 text-sm placeholder:text-muted-foreground focus:border-white/40 focus:outline-none sm:pr-12"
          />
          {query.length === 0 && (
            <kbd
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-white/15 px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex"
            >
              /
            </kbd>
          )}
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-white/10 hover:text-foreground"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          )}
        </div>
        {isFiltering && (
          <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
            Showing {filtered.length} of {entries.length}{" "}
            {entries.length === 1 ? "entry" : "entries"}
            {serverSearching && " · searching full text…"}
          </p>
        )}
      </div>

      {filtered.length === 0 && !showTodayPlaceholder ? (
        !isFiltering && recoveryState === "loading" ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Loading entries…
          </p>
        ) : !isFiltering && recoveryState === "failed" ? (
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-4" aria-live="polite">
            <p className="text-sm text-muted-foreground">
              Couldn&apos;t load entries right now — the server may be briefly unavailable.
            </p>
            <button
              type="button"
              onClick={() => void runRecovery()}
              className="mt-3 inline-flex min-h-9 items-center rounded-md border border-white/15 px-3 text-sm font-medium hover:bg-white/10"
            >
              Retry
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {isFiltering
              ? serverSearching
                ? "Searching…"
                : "No entries match your search."
              : "No entries yet."}
          </p>
        )
      ) : (
        <div className="space-y-10">
          {(() => {
            // If today's year isn't already a section (e.g., no entries yet
            // for this calendar year), inject an empty one so the placeholder
            // row has somewhere to live.
            const sections =
              showTodayPlaceholder && !grouped.some((g) => g.year === todayYear)
                ? [{ year: todayYear, entries: [] as JournalEntry[] }, ...grouped]
                : grouped;
            return sections.map(({ year, entries: yearEntries }) => {
              const renderTodayPlaceholderHere =
                showTodayPlaceholder && year === todayYear;
              return (
                <section key={year}>
                  <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {year}
                  </h2>
                  <ul className="divide-y rounded-md border">
                    {renderTodayPlaceholderHere && (
                      <li>
                        <Link
                          href={`/journal/${today}`}
                          className="block px-4 py-3 hover:bg-muted/50"
                        >
                          <div className="flex items-baseline justify-between">
                            <span className="flex items-center gap-2">
                              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                                {weekdayShortLabel(today)}
                              </span>
                              <span className="font-mono text-sm tabular-nums text-muted-foreground">
                                {today}
                              </span>
                              <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-blue-400">
                                Today
                              </span>
                            </span>
                          </div>
                          <p className="mt-1 text-xs italic text-muted-foreground">
                            No entry yet — be the first to write.
                          </p>
                        </Link>
                      </li>
                    )}
                    {yearEntries.map((e) => {
                      const excerpt = e.contentExcerpt ? toPlainExcerpt(e.contentExcerpt, EXCERPT_LEN) : "";
                      const authorName = e.author?.name?.trim() || "Anonymous";
                      const relLabel = relativeDayLabel(e.date, today);
                      const isRecent = relLabel === "Today" || relLabel === "Yesterday";
                      const tzTag = timezoneTagFor(e.authorTimezone, viewerTz);
                      return (
                        <li key={e.id}>
                          <Link
                            href={`/journal/${e.date}`}
                            className="block px-4 py-3 hover:bg-muted/50"
                          >
                            <div className="flex items-baseline justify-between">
                              <span className="flex items-center gap-2">
                                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                                  {weekdayShortLabel(e.date)}
                                </span>
                                <span className="font-mono text-sm tabular-nums">
                                  {highlightMatches(e.date, trimmed)}
                                </span>
                                {tzTag && (
                                  <span
                                    className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-gray-400"
                                    title={`Posted in ${tzTag}; you're viewing in ${viewerTz}`}
                                  >
                                    {tzTag}
                                  </span>
                                )}
                                {relLabel && (
                                  <span
                                    className={
                                      isRecent
                                        ? "rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-blue-400"
                                        : "rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-gray-400"
                                    }
                                  >
                                    {relLabel}
                                  </span>
                                )}
                              </span>
                              <span className="ml-4 flex items-center gap-3 text-xs text-muted-foreground">
                                <span>
                                  {e.editCount} edit{e.editCount === 1 ? "" : "s"}
                                </span>
                                {e.commentCount > 0 && (
                                  <span>
                                    {e.commentCount} comment{e.commentCount === 1 ? "" : "s"}
                                  </span>
                                )}
                                {e.appendCount > 0 && (
                                  <span>
                                    {e.appendCount} append{e.appendCount === 1 ? "" : "s"}
                                  </span>
                                )}
                                {e.pendingSuggestionCount > 0 && (
                                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
                                    {e.pendingSuggestionCount} pending
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                              {e.author?.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={e.author.avatarUrl}
                                  alt=""
                                  className="h-4 w-4 rounded-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : null}
                              <span>{highlightMatches(authorName, trimmed)}</span>
                            </div>
                            {excerpt && (
                              <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                                {highlightMatches(excerpt, trimmed)}
                              </p>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
}
