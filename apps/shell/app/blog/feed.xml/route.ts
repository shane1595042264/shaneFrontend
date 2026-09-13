import {
  loadFeedItems,
  feedLastModifiedMs,
  SITE_URL,
  FEED_TITLE,
  FEED_DESCRIPTION,
} from "@/lib/blog-feed";

// RSS 2.0 for the public blog (SHAN-491). Mirrors /blog/feed.json item for
// item; the two share the data layer in @/lib/blog-feed so they can't drift.

const FEED_URL = `${SITE_URL}/blog/feed.xml`;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// CDATA cannot contain the literal "]]>" — split it so the section stays well
// formed even if a post's rendered HTML happens to include that sequence.
function cdataWrap(html: string): string {
  return `<![CDATA[${html.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

// RFC 822 date, which is what RSS wants. Falls back to now for a value the API
// somehow returned unparseable, so one bad row can't emit an invalid channel.
function toRfc822(ts: string): string {
  const d = new Date(ts);
  return (isNaN(d.getTime()) ? new Date() : d).toUTCString();
}

export const revalidate = 3600;

export async function GET() {
  const feedItems = await loadFeedItems();

  const lastModifiedMs = feedLastModifiedMs(feedItems);
  const lastBuildDate =
    lastModifiedMs !== null
      ? new Date(lastModifiedMs).toUTCString()
      : new Date().toUTCString();

  const items = feedItems.map((post) => {
    const contentEncoded = post.contentHtml
      ? `\n      <content:encoded>${cdataWrap(post.contentHtml)}</content:encoded>`
      : "";
    const categories = post.tags
      .map((tag) => `\n      <category>${escapeXml(tag)}</category>`)
      .join("");
    // media:content rather than <enclosure>: enclosure requires a byte length
    // we'd have to HEAD the image to learn, and Media RSS is what readers
    // actually key on for a post's lead image.
    const cover = post.coverUrl
      ? `\n      <media:content url="${escapeXml(post.coverUrl)}" medium="image"/>`
      : "";
    return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(post.url)}</link>
      <guid isPermaLink="true">${escapeXml(post.url)}</guid>
      <pubDate>${toRfc822(post.publishedAt)}</pubDate>
      <dc:creator>${escapeXml(post.authorName)}</dc:creator>
      <description>${escapeXml(post.excerpt)}</description>${categories}${cover}${contentEncoded}
    </item>`;
  });

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${escapeXml(FEED_TITLE)}</title>
    <link>${SITE_URL}/blog</link>
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
