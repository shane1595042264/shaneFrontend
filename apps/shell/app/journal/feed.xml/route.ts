import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toPlainExcerpt } from "@/lib/journal-text";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const JOURNAL_API_URL = process.env.NEXT_PUBLIC_JOURNAL_API_URL || API_URL;
const SITE_URL = "https://shanejli.com";
const FEED_URL = `${SITE_URL}/journal/feed.xml`;
const FEED_DESCRIPTION =
  "Shane Li's daily journal — workouts, code, travel, and the texture of ordinary days.";
const MAX_ENTRIES = 50;
const EXCERPT_LEN = 400;

type EntryRow = {
  date: string;
  contentExcerpt: string | null;
  createdAt: string;
  updatedAt: string;
};

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

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
// import in a route module, but a route handler emitting XML is a legitimate
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

// CDATA cannot contain the literal "]]>" — split it so the section stays well
// formed even if an entry's rendered HTML happens to include that sequence.
function cdataWrap(html: string): string {
  return `<![CDATA[${html.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

function formatTitle(date: string): string {
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
// experience) rendered to HTML for <content:encoded>. Returns null on any
// failure so a single bad fetch degrades that item to excerpt-only instead of
// breaking the whole feed.
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

export const revalidate = 3600;

export async function GET() {
  const entries = await fetchEntries();

  // Fetch full bodies in parallel; index-aligned with `entries`.
  const contentHtml = await Promise.all(entries.map((e) => fetchEntryContentHtml(e.date)));

  const lastBuildDate =
    entries.length > 0
      ? new Date(Math.max(...entries.map((e) => Date.parse(e.updatedAt)))).toUTCString()
      : new Date().toUTCString();

  const items = entries.map((entry, i) => {
    const title = formatTitle(entry.date);
    const link = `${SITE_URL}/journal/${entry.date}`;
    const excerpt = toPlainExcerpt(entry.contentExcerpt ?? "", EXCERPT_LEN);
    const pubDate = new Date(entry.createdAt).toUTCString();
    const html = contentHtml[i];
    const contentEncoded = html
      ? `\n      <content:encoded>${cdataWrap(html)}</content:encoded>`
      : "";
    return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(excerpt)}</description>${contentEncoded}
    </item>`;
  });

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Shane's Journal</title>
    <link>${SITE_URL}/journal</link>
    <description>${escapeXml(FEED_DESCRIPTION)}</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${FEED_URL}" rel="self" type="application/rss+xml"/>
${items.join("\n")}
  </channel>
</rss>`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
