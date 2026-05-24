"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toPlainExcerpt } from "@/lib/journal-text";
import { useAuth } from "@/lib/auth-context";
import { getTodayInTimezone, resolveViewerTimezone, timezoneTagFor } from "@/lib/timezone";

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
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

export function JournalSearchList({ entries, today: ssrToday }: Props) {
  const { user } = useAuth();
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

  const filtered = useMemo(() => {
    if (!trimmed) return entries;
    const needle = trimmed.toLowerCase();
    return entries.filter((e) => {
      const haystack = [
        e.date,
        e.contentExcerpt ?? "",
        e.author?.name ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [entries, trimmed]);

  const grouped = useMemo(() => groupByYear(filtered), [filtered]);
  const isFiltering = trimmed.length > 0;
  const todayHasEntry = useMemo(
    () => entries.some((e) => e.date === today),
    [entries, today]
  );
  const todayYear = today.slice(0, 4);
  // Surface the today-placeholder row only on the unfiltered list, so search
  // results stay strictly about matches.
  const showTodayPlaceholder = !isFiltering && !todayHasEntry;

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
          </p>
        )}
      </div>

      {filtered.length === 0 && !showTodayPlaceholder ? (
        <p className="text-sm text-muted-foreground">
          {isFiltering ? "No entries match your search." : "No entries yet."}
        </p>
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
                      const isToday = e.date === today;
                      const tzTag = timezoneTagFor(e.authorTimezone, viewerTz);
                      return (
                        <li key={e.id}>
                          <Link
                            href={`/journal/${e.date}`}
                            className="block px-4 py-3 hover:bg-muted/50"
                          >
                            <div className="flex items-baseline justify-between">
                              <span className="flex items-center gap-2">
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
                                {isToday && (
                                  <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-blue-400">
                                    Today
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
