import {
  loadFeedItems,
  feedLastModifiedMs,
  SITE_URL,
  FEED_TITLE,
  FEED_DESCRIPTION,
} from "@/lib/journal-feed";

const FEED_URL = `${SITE_URL}/journal/feed.xml`;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// CDATA cannot contain the literal "]]>" — split it so the section stays well
// formed even if an entry's rendered HTML happens to include that sequence.
function cdataWrap(html: string): string {
  return `<![CDATA[${html.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

export const revalidate = 3600;

export async function GET() {
  const feedItems = await loadFeedItems();

  const lastModifiedMs = feedLastModifiedMs(feedItems);
  const lastBuildDate =
    lastModifiedMs !== null
      ? new Date(lastModifiedMs).toUTCString()
      : new Date().toUTCString();

  const items = feedItems.map((entry) => {
    const pubDate = new Date(entry.createdAt).toUTCString();
    const contentEncoded = entry.contentHtml
      ? `\n      <content:encoded>${cdataWrap(entry.contentHtml)}</content:encoded>`
      : "";
    return `    <item>
      <title>${escapeXml(entry.title)}</title>
      <link>${escapeXml(entry.url)}</link>
      <guid isPermaLink="true">${escapeXml(entry.url)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(entry.excerpt)}</description>${contentEncoded}
    </item>`;
  });

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(FEED_TITLE)}</title>
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
