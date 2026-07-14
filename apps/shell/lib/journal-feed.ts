import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toPlainExcerpt } from "@/lib/journal-text";

// Shared data + rendering layer for the journal feeds. Both the RSS feed
// (/journal/feed.xml) and the JSON Feed (/journal/feed.json) build on this so
// the two stay in lockstep — they differ only in serialization.

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const JOURNAL_API_URL = process.env.NEXT_PUBLIC_JOURNAL_API_URL || API_URL;

export const SITE_URL = "https://shanejli.com";
export const FEED_TITLE = "Shane's Journal";
export const FEED_DESCRIPTION =
  "Shane Li's daily journal — workouts, code, travel, and the texture of ordinary days.";
export const FEED_AUTHOR = "Shane Li";
export const MAX_ENTRIES = 50;
export const EXCERPT_LEN = 400;

type EntryRow = {
  date: string;
  contentExcerpt: string | null;
  createdAt: string;
  updatedAt: string;
};

// The excerpt pipeline strips [[data:...|label|...]] markers to their label;
// mirror that here so the full-content HTML never leaks a raw marker. Kept in
// sync with DATA_MARKER_RE in lib/journal-text.ts.
const DATA_MARKER_RE = /\[\[data:[^|]+\|([^|]+)\|[\s\S]+?\]\]/g;
function stripDataMarkers(text: string): string {
  return text.replace(DATA_MARKER_RE, "$1");
}

// Render an entry's markdown body to a static HTML string using the same
// react-markdown + GFM stack the on-site EntryBody renders with, so feed
// readers see the entry exactly as the site does. react-dom/server and react
// are imported dynamically: the App Router forbids a *static* react-dom/server
// import in a route module, but a route handler emitting a feed is a legitimate
// server-string-render use case, and the dynamic import is module-cached so
// repeated calls are cheap.
async function renderMarkdownToHtml(source: string): Promise<string> {
  const [{ renderToStaticMarkup }, { createElement }] = await Promise.all([
    import("react-dom/server"),
    import("react"),
  ]);
  return renderToStaticMarkup(
    createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, source),
  );
}

export function formatTitle(date: string): string {
  const d = new Date(date + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

async function fetchEntries(): Promise<EntryRow[]> {
  try {
    const res = await fetch(
      `${JOURNAL_API_URL}/api/journal/entries?limit=${MAX_ENTRIES}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const list = (await res.json()) as {
      entries: Array<{ date: string; createdAt: string; updatedAt: string; contentExcerpt: string | null }>;
    };
    return (list.entries ?? []).map((e) => ({
      date: e.date,
      contentExcerpt: e.contentExcerpt ?? null,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    }));
  } catch {
    return [];
  }
}

// Full body (primary content + every append, matching the on-page reading
// experience) rendered to HTML. Returns null on any failure so a single bad
// fetch degrades that item to excerpt-only instead of breaking the whole feed.
async function fetchEntryContentHtml(date: string): Promise<string | null> {
  try {
    const res = await fetch(`${JOURNAL_API_URL}/api/journal/entries/${date}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      content?: string;
      appends?: Array<{ content: string }>;
    };
    const source = [data.content ?? "", ...(data.appends ?? []).map((a) => a.content)]
      .filter((s) => s.trim().length > 0)
      .join("\n\n");
    if (!source.trim()) return null;
    return await renderMarkdownToHtml(stripDataMarkers(source));
  } catch {
    return null;
  }
}

export type FeedItem = {
  date: string;
  title: string;
  url: string;
  excerpt: string;
  contentHtml: string | null;
  createdAt: string;
  updatedAt: string;
};

// The 50 most-recent entries, resolved with full-body HTML fetched in parallel
// (index-aligned) and a plain-text excerpt fallback. Used by both feed routes.
export async function loadFeedItems(): Promise<FeedItem[]> {
  const entries = await fetchEntries();
  const contentHtml = await Promise.all(entries.map((e) => fetchEntryContentHtml(e.date)));
  return entries.map((entry, i) => ({
    date: entry.date,
    title: formatTitle(entry.date),
    url: `${SITE_URL}/journal/${entry.date}`,
    excerpt: toPlainExcerpt(entry.contentExcerpt ?? "", EXCERPT_LEN),
    contentHtml: contentHtml[i],
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  }));
}

// Most-recent updatedAt across the feed, as an epoch ms value; falls back to
// null when the feed is empty so callers can pick their own "now".
export function feedLastModifiedMs(items: FeedItem[]): number | null {
  if (items.length === 0) return null;
  return Math.max(...items.map((i) => Date.parse(i.updatedAt)));
}
