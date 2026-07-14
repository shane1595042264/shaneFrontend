import {
  loadFeedItems,
  SITE_URL,
  FEED_TITLE,
  FEED_DESCRIPTION,
  FEED_AUTHOR,
} from "@/lib/journal-feed";

// JSON Feed 1.1 (https://jsonfeed.org/version/1.1) — the modern feed format
// natively supported by Feedbin, NetNewsWire, Inoreader, Reeder. Mirrors the
// RSS feed at /journal/feed.xml item-for-item; the two share the same data
// layer in @/lib/journal-feed so they stay in lockstep.

const FEED_URL = `${SITE_URL}/journal/feed.json`;

// Normalize an API timestamp to an RFC 3339 string. JSON Feed requires
// date_published / date_modified in RFC 3339; the API already returns ISO 8601
// but round-tripping through Date guarantees a valid, canonical value.
function toRfc3339(ts: string): string {
  const d = new Date(ts);
  return isNaN(d.getTime()) ? ts : d.toISOString();
}

export const revalidate = 3600;

export async function GET() {
  const feedItems = await loadFeedItems();

  const feed = {
    version: "https://jsonfeed.org/version/1.1",
    title: FEED_TITLE,
    home_page_url: `${SITE_URL}/journal`,
    feed_url: FEED_URL,
    description: FEED_DESCRIPTION,
    language: "en-us",
    authors: [{ name: FEED_AUTHOR, url: SITE_URL }],
    items: feedItems.map((entry) => ({
      id: entry.url,
      url: entry.url,
      title: entry.title,
      // Spec requires content_html or content_text; provide the rendered body
      // when available and always carry the excerpt as summary + text fallback.
      ...(entry.contentHtml
        ? { content_html: entry.contentHtml }
        : { content_text: entry.excerpt }),
      summary: entry.excerpt,
      date_published: toRfc3339(entry.createdAt),
      date_modified: toRfc3339(entry.updatedAt),
    })),
  };

  return new Response(JSON.stringify(feed), {
    status: 200,
    headers: {
      "Content-Type": "application/feed+json; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
