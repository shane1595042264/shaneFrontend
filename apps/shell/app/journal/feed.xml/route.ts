const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const JOURNAL_API_URL = process.env.NEXT_PUBLIC_JOURNAL_API_URL || API_URL;
const SITE_URL = "https://shanejli.com";
const FEED_URL = `${SITE_URL}/journal/feed.xml`;
const MAX_ENTRIES = 50;
const EXCERPT_LEN = 400;

type EntryRow = {
  date: string;
  content: string;
  updatedAt: string;
};

// Keep in sync with backend /api/journal/feed
function stripDataMarkers(text: string): string {
  return text.replace(/\[\[data:[^|]+\|([^|]+)\|[\s\S]*?\]\]/g, "$1");
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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

function buildExcerpt(content: string): string {
  const plain = stripDataMarkers(content).replace(/\s+/g, " ").trim();
  return plain.length > EXCERPT_LEN
    ? plain.slice(0, EXCERPT_LEN).trimEnd() + "..."
    : plain;
}

async function fetchEntries(): Promise<EntryRow[]> {
  try {
    const res = await fetch(
      `${JOURNAL_API_URL}/api/journal/entries?limit=${MAX_ENTRIES}&offset=0`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { entries: EntryRow[] };
    return data.entries ?? [];
  } catch {
    return [];
  }
}

export const revalidate = 3600;

export async function GET() {
  const entries = await fetchEntries();

  const lastBuildDate =
    entries.length > 0
      ? new Date(entries[0].updatedAt).toUTCString()
      : new Date().toUTCString();

  const items = entries.map((entry) => {
    const title = formatTitle(entry.date);
    const link = `${SITE_URL}/journal/${entry.date}`;
    const excerpt = buildExcerpt(entry.content);
    const pubDate = new Date(entry.updatedAt).toUTCString();
    return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(excerpt)}</description>
    </item>`;
  });

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Shane's Journal</title>
    <link>${SITE_URL}/journal</link>
    <description>AI-generated daily journal entries from Shane's life — workouts, code, travel, and more.</description>
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
