"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EntryBody } from "@/components/journal/entry-body";
import { EntryActions } from "@/components/journal/entry-actions";
import { EntryActivity } from "@/components/journal/entry-activity";
import { EntryAppends } from "@/components/journal/entry-appends";
import { EntryKeyboardNav } from "@/components/journal/entry-keyboard-nav";
import { ShareActions } from "@/components/journal/share-actions";
import { CommentsThread } from "@/components/journal/comments-thread";
import { EntryReactionBar } from "@/components/journal/entry-reaction-bar";
import { MissingEntryCta } from "@/components/journal/missing-entry-cta";
import { readingTimeMinutes } from "@/lib/journal-text";
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
  const entryUrl = `${SITE_URL}/journal/${date}`;

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-8 py-6">
      {backLink}

      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          <article className="pb-8">
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
                {readingTimeMinutes(fullContent)} min read
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
            <div className="mt-4">
              <EntryBody content={data.content} />
            </div>
            {data.appends && data.appends.length > 0 && (
              <EntryAppends
                date={data.entry.date}
                appends={data.appends}
                onEdited={applyAppendEdit}
                onDeleted={applyAppendDelete}
              />
            )}
          </article>

          <div className="mt-6">
            <EntryReactionBar date={data.entry.date} />
          </div>

          <ShareActions date={data.entry.date} formattedDate={formatDate(data.entry.date)} />

          {/* Print-only canonical URL footer (so a printed/PDF page is self-attributing) */}
          <p className="hidden print:block mt-8 pt-4 border-t border-gray-300 text-xs text-gray-600">
            {entryUrl}
          </p>

          {prevNextNav}
          <EntryKeyboardNav prevDate={neighbors.prev} nextDate={neighbors.next} />

          <CommentsThread date={data.entry.date} entryAuthorId={data.entry.authorId} />

          <EntryActivity date={data.entry.date} />
        </div>
        {sidebar}
      </div>
    </div>
  );
}
