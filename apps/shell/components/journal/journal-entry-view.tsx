"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/transition-link";
import { EntryActions } from "@/components/journal/entry-actions";
import { EntryActivity } from "@/components/journal/entry-activity";
import { EntryAppends } from "@/components/journal/entry-appends";
import { EntryKeyboardNav } from "@/components/journal/entry-keyboard-nav";
import { ShareActions } from "@/components/journal/share-actions";
import { CommentsThread } from "@/components/journal/comments-thread";
import { EntryReactionBar } from "@/components/journal/entry-reaction-bar";
import { MissingEntryCta } from "@/components/journal/missing-entry-cta";
import { JournalToc } from "@/components/journal/journal-toc";
import { NotesProvider, OrphanNotes } from "@/components/notes/inline-notes";
import { journalNotesAdapter } from "@/components/notes/adapters";
import { NotedEntryBody } from "@/components/journal/noted-entry-body";
import { MarkdownHashScroll } from "@/components/markdown-hash-scroll";
import { ReadingTracker } from "@/components/journal/reading-tracker";
import { readingTimeMinutes } from "@/lib/journal-text";
import { buildJournalToc, ENTRY_BODY_ANCHOR, shouldShowJournalToc } from "@/lib/journal-toc";
import {
  getEntry,
  getNeighbors,
  type EntryDetail,
  type JournalAppend,
} from "@/lib/api/journal";
import { getTodayInTimezone, relativeDayLabel, resolveViewerTimezone } from "@/lib/timezone";
import { useAuth } from "@/lib/auth-context";

const SITE_URL = "https://shanejli.com";

interface Props {
  date: string;
  /**
   * Rendered on the server and handed in as a slot. Activities come from a
   * separate, already-public API, so keeping it a Server Component costs the
   * viewer nothing and avoids a second client waterfall.
   */
  sidebar: React.ReactNode;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Client-side renderer for one journal entry (SHAN-475).
 *
 * The journal is invite-only, so the entry body can never be server-rendered:
 * an SSR fetch carries no Authorization header (the JWT is in localStorage) and
 * the ISR document it would produce is publicly cached. Everything private is
 * therefore fetched here, behind JournalAccessGate, with the viewer's token.
 */
export function JournalEntryView({ date, sidebar }: Props) {
  const { user } = useAuth();
  const [data, setData] = useState<EntryDetail | null>(null);
  const [neighbors, setNeighbors] = useState<{ prev: string | null; next: string | null }>({
    prev: null,
    next: null,
  });
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const articleRef = useRef<HTMLElement>(null);

  // SHAN-571. The outline for the whole date: the entry and each append as a
  // timestamped part, with that part's own headings under it. Built from the
  // exact strings EntryBody renders, because heading ids are keyed on source
  // lines, and rebuilt whenever an append is edited or deleted in place.
  const toc = useMemo(
    () =>
      data?.entry
        ? buildJournalToc([
            {
              key: "entry",
              anchorId: ENTRY_BODY_ANCHOR,
              content: data.content,
              createdAt: data.entry.createdAt,
              timezone: data.entry.authorTimezone,
            },
            ...data.appends.map((a) => ({
              key: a.id,
              anchorId: `append-${a.id}`,
              content: a.content,
              createdAt: a.createdAt,
              timezone: a.authorTimezone,
            })),
          ])
        : [],
    [data]
  );
  const headingsByAppend = useMemo(
    () => Object.fromEntries(toc.slice(1).map((p) => [p.key, p.headings])),
    [toc]
  );

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    Promise.all([getEntry(date), getNeighbors(date)])
      .then(([entry, near]) => {
        if (cancelled) return;
        setData(entry);
        setNeighbors(near);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  // Appends live in this component's `data` because the reading-time estimate
  // below counts them, so an edit or a delete has to fold back in here rather
  // than staying local to the list.
  const applyAppendEdit = (updated: JournalAppend) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            appends: prev.appends.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)),
          }
        : prev
    );
  };

  const applyAppendDelete = (id: string) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            appends: prev.appends.filter((a) => a.id !== id),
            entry: {
              ...prev.entry,
              appendCount: Math.max(0, prev.entry.appendCount - 1),
            },
          }
        : prev
    );
  };

  const today = getTodayInTimezone(resolveViewerTimezone(user));
  const isToday = date === today;
  const relLabel = relativeDayLabel(date, today);
  const isRecentRel = relLabel === "Today" || relLabel === "Yesterday";
  const relChipClass = isRecentRel
    ? "rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-blue-400"
    : "rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-gray-400";

  const backLink = (
    <Link
      href="/journal"
      className="inline-block mb-6 text-sm text-gray-400 hover:text-gray-300 transition-colors print:hidden"
    >
      &larr; All entries
    </Link>
  );

  const prevNextNav =
    neighbors.prev || neighbors.next ? (
      <nav className="flex items-center justify-between mt-10 pt-6 border-t border-white/8 print:hidden">
        {neighbors.prev ? (
          <Link
            href={`/journal/${neighbors.prev}`}
            aria-keyshortcuts="ArrowLeft j"
            className="group flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            <span className="group-hover:-translate-x-0.5 transition-transform">&larr;</span>
            <span>{formatDateShort(neighbors.prev)}</span>
          </Link>
        ) : (
          <span />
        )}
        {neighbors.next ? (
          <Link
            href={`/journal/${neighbors.next}`}
            aria-keyshortcuts="ArrowRight k"
            className="group flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            <span>{formatDateShort(neighbors.next)}</span>
            <span className="group-hover:translate-x-0.5 transition-transform">&rarr;</span>
          </Link>
        ) : (
          <span />
        )}
      </nav>
    ) : null;

  if (state === "loading") {
    return (
      <div className="max-w-2xl mx-auto px-4 md:px-8 py-6">
        {backLink}
        <div className="flex items-center justify-center py-24">
          <div
            className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white"
            role="status"
            aria-label="Loading entry"
          />
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="max-w-2xl mx-auto px-4 md:px-8 py-6">
        {backLink}
        <p className="text-sm text-gray-400" aria-live="polite">
          Couldn&apos;t load this entry right now — the server may be briefly unavailable.
        </p>
      </div>
    );
  }

  if (!data?.entry) {
    // No entry for this date yet. Any member can be the first to write it.
    return (
      <div className="max-w-2xl mx-auto px-4 md:px-8 py-6">
        {backLink}
        <article className="pb-8">
          <h2 className="text-base font-semibold text-white/80 tracking-tight mb-3 flex items-center gap-2">
            <time dateTime={date}>{formatDate(date)}</time>
            {relLabel && <span className={relChipClass}>{relLabel}</span>}
          </h2>
          <MissingEntryCta date={date} isToday={isToday} />
        </article>
        {prevNextNav}
        <EntryKeyboardNav prevDate={neighbors.prev} nextDate={neighbors.next} />
      </div>
    );
  }

  // Appends render on the same page, so the reader-facing "N min read"
  // estimate must cover them too — otherwise it under-reports.
  const fullContent = [data.content, ...data.appends.map((a) => a.content)].join("\n\n");
  const minutes = readingTimeMinutes(fullContent);
  const entryUrl = `${SITE_URL}/journal/${date}`;
  const showToc = shouldShowJournalToc(toc);

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-8 py-6">
      {/* The entry arrives in a client fetch, so the browser's own fragment
          scroll on /journal/<date>#<section> found nothing to land on. Mounted
          here, with the content, so its retry window starts when there is
          something to scroll to. */}
      <MarkdownHashScroll />
      {/* SHAN-597: opens at the reader's saved spot (unless the URL names a
          section, which wins) and keeps that spot synced as they scroll. */}
      <ReadingTracker date={data.entry.date} articleRef={articleRef} />
      {backLink}

      {/* SHAN-577: inline notes. The provider spans the whole grid so the
          selection pill, the composer and the hover threads (all portalled)
          share one state with the marks in the entry and every append. */}
      <NotesProvider
        adapter={journalNotesAdapter(data.entry.date, data.entry.authorId)}
        documentTitle={`Journal entry for ${formatDate(data.entry.date)}`}
      >
      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          <article ref={articleRef} className="pb-8">
            <h2 className="text-base font-semibold text-white/80 tracking-tight mb-3 flex items-center gap-2">
              <time dateTime={data.entry.date}>{formatDate(data.entry.date)}</time>
              {relLabel && <span className={relChipClass}>{relLabel}</span>}
              {data.entry.editCount > 0 && (
                <Link
                  href={`/journal/${data.entry.date}/history`}
                  title={`Last edited ${new Date(data.entry.updatedAt).toLocaleString()}`}
                  className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-200"
                >
                  edited
                </Link>
              )}
              <span className="ml-auto text-xs font-normal text-gray-400">
                {minutes} min read
              </span>
            </h2>
            <div className="mb-4 flex items-center gap-2 text-xs text-gray-400">
              {data.author?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.author.avatarUrl}
                  alt=""
                  className="h-5 w-5 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : null}
              <span className="text-gray-300">{data.author?.name?.trim() || "Anonymous"}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <EntryActions date={data.entry.date} authorId={data.entry.authorId} />
              {data.entry.pendingSuggestionCount > 0 && (
                <Link
                  href={`/journal/${data.entry.date}/suggestions`}
                  className="rounded border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-500/25 hover:text-amber-100"
                >
                  {data.entry.pendingSuggestionCount} pending suggestion
                  {data.entry.pendingSuggestionCount === 1 ? "" : "s"} → review
                </Link>
              )}
            </div>
            <div id={ENTRY_BODY_ANCHOR} className="mt-4 scroll-mt-under-header">
              <NotedEntryBody target="entry" content={data.content} headings={toc[0]?.headings} />
            </div>
            {data.appends && data.appends.length > 0 && (
              <EntryAppends
                date={data.entry.date}
                appends={data.appends}
                onEdited={applyAppendEdit}
                onDeleted={applyAppendDelete}
                headingsByAppend={headingsByAppend}
              />
            )}
          </article>

          <OrphanNotes />

          <div className="mt-6">
            <EntryReactionBar date={data.entry.date} />
          </div>

          <ShareActions date={data.entry.date} formattedDate={formatDate(data.entry.date)} />

          {/* Print-only canonical URL footer (so a printed/PDF page is self-attributing).
              contrast-exempt: print:block means this shade lands on white paper,
              where gray-600 is 7.6:1, not on the site's near-black background. */}
          <p className="hidden print:block mt-8 pt-4 border-t border-gray-300 text-xs text-gray-600">
            {entryUrl}
          </p>

          {prevNextNav}
          <EntryKeyboardNav prevDate={neighbors.prev} nextDate={neighbors.next} />

          <CommentsThread date={data.entry.date} entryAuthorId={data.entry.authorId} />

          <EntryActivity date={data.entry.date} />
        </div>
        {showToc ? (
          <div className="min-w-0 space-y-8">
            {/* Wrapped so the activity aside's own `sticky` has no room to
                move: the contents rail below is the one thing in this column
                that should follow the reader down a long day. */}
            <div>{sidebar}</div>
            <JournalToc
              parts={toc}
              entryDate={data.entry.date}
              minutes={minutes}
              articleRef={articleRef}
            />
          </div>
        ) : (
          sidebar
        )}
      </div>
      </NotesProvider>
    </div>
  );
}
