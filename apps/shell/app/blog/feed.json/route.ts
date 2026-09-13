import {
  loadFeedItems,
  SITE_URL,
  FEED_TITLE,
  FEED_DESCRIPTION,
  FEED_AUTHOR,
} from "@/lib/blog-feed";

// JSON Feed 1.1 (https://jsonfeed.org/version/1.1) — the modern feed format
// natively supported by Feedbin, NetNewsWire, Inoreader, Reeder. Mirrors the
// RSS feed at /blog/feed.xml item-for-item; the two share the same data layer
// in @/lib/blog-feed so they stay in lockstep (SHAN-491).

const FEED_URL = `${SITE_URL}/blog/feed.json`;

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
    home_page_url: `${SITE_URL}/blog`,
    feed_url: FEED_URL,
    description: FEED_DESCRIPTION,
    language: "en-us",
    authors: [{ name: FEED_AUTHOR, url: SITE_URL }],
    items: feedItems.map((post) => ({
      id: post.url,
      url: post.url,
      title: post.title,
      // Spec requires content_html or content_text; provide the rendered body
      // when available and always carry the excerpt as summary + text fallback.
      ...(post.contentHtml
        ? { content_html: post.contentHtml }
        : { content_text: post.excerpt }),
      summary: post.excerpt,
      ...(post.coverUrl ? { image: post.coverUrl } : {}),
      ...(post.tags.length ? { tags: post.tags } : {}),
      authors: [{ name: post.authorName }],
      date_published: toRfc3339(post.publishedAt),
      date_modified: toRfc3339(post.updatedAt),
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
