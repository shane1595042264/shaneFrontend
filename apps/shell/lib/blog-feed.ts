import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toPlainExcerpt } from "@/lib/journal-text";
import { API_URL, BACKEND_ORIGIN } from "@/lib/api-url";

// Shared data + rendering layer for the blog feeds (SHAN-491). Both the RSS
// feed (/blog/feed.xml) and the JSON Feed (/blog/feed.json) build on this so
// the two stay in lockstep — they differ only in serialization.
//
// This is the retired lib/journal-feed.ts, repointed at the blog. The journal
// went invite-only in SHAN-475 and its feeds became 404 stubs, because a feed
// is an unauthenticated pull with no viewer to check membership against. The
// blog has the opposite posture: every read here is answerable anonymously,
// which is the whole point of the element, so a feed is the natural fit.

export const SITE_URL = "https://shanejli.com";
export const FEED_TITLE = "Shane's Blog";
export const FEED_DESCRIPTION =
  "Shane's public blog: long-form writing on software, travel, and whatever else stuck.";
export const FEED_AUTHOR = "Shane Li";
export const MAX_POSTS = 50;
export const EXCERPT_LEN = 400;

type PostRow = {
  slug: string;
  title: string;
  authorName: string | null;
  coverImageUrl: string | null;
  tags: string[];
  contentExcerpt: string | null;
  publishedAt: string;
  updatedAt: string;
};

// Render a post's markdown body to a static HTML string using the same
// react-markdown + GFM stack PostBody renders with, so feed readers see the
// post roughly as the site does. Deliberately NOT markdownComponents: those
// carry the client-side mermaid upgrade (SHAN-439), which has no meaning in a
// feed — mermaid blocks stay as code, exactly as the journal feed left them.
//
// react-dom/server and react are imported dynamically: the App Router forbids
// a *static* react-dom/server import in a route module (SHAN-374), but a route
// handler emitting a feed is a legitimate server-string-render use case, and
// the dynamic import is module-cached so repeated calls are cheap.
async function renderMarkdownToHtml(source: string): Promise<string> {
  const [{ renderToStaticMarkup }, { createElement }] = await Promise.all([
    import("react-dom/server"),
    import("react"),
  ]);
  return renderToStaticMarkup(
    createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, source),
  );
}

// No auth header, by design and not by omission: an anonymous caller gets
// published posts only, so the author's drafts can never reach a subscriber.
async function fetchPosts(): Promise<PostRow[]> {
  try {
    const res = await fetch(`${API_URL}/api/blog/posts?limit=${MAX_POSTS}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const list = (await res.json()) as {
      posts?: Array<{
        slug: string;
        title: string;
        author: { name: string | null } | null;
        coverImageUrl: string | null;
        tags: string[] | null;
        contentExcerpt: string | null;
        publishedAt: string;
        updatedAt: string;
      }>;
    };
    return (list.posts ?? []).map((p) => ({
      slug: p.slug,
      title: p.title,
      authorName: p.author?.name ?? null,
      coverImageUrl: p.coverImageUrl ?? null,
      tags: p.tags ?? [],
      contentExcerpt: p.contentExcerpt ?? null,
      publishedAt: p.publishedAt,
      updatedAt: p.updatedAt,
    }));
  } catch {
    return [];
  }
}

// Full body rendered to HTML. Returns null on any failure so a single bad
// fetch degrades that item to excerpt-only instead of breaking the whole feed.
async function fetchPostContentHtml(slug: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${API_URL}/api/blog/posts/${encodeURIComponent(slug)}`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: string };
    const source = data.content ?? "";
    if (!source.trim()) return null;
    return await renderMarkdownToHtml(source);
  } catch {
    return null;
  }
}

export type BlogFeedItem = {
  slug: string;
  title: string;
  url: string;
  excerpt: string;
  contentHtml: string | null;
  /** Absolute, or null when the post has no cover. */
  coverUrl: string | null;
  tags: string[];
  authorName: string;
  publishedAt: string;
  updatedAt: string;
};

// Covers are stored relative to the backend (`/api/journal/images/<id>`) so
// they survive an origin change. A feed item is read far from shanejli.com, so
// a relative path resolves against the reader's host or against nothing at
// all — always absolutize. Mirrors coverSrc() in lib/api/blog.ts.
function absoluteCover(coverImageUrl: string | null): string | null {
  if (!coverImageUrl) return null;
  return coverImageUrl.startsWith("/")
    ? `${BACKEND_ORIGIN}${coverImageUrl}`
    : coverImageUrl;
}

// The 50 most-recent published posts, resolved with full-body HTML fetched in
// parallel (index-aligned) and a plain-text excerpt fallback. Used by both
// feed routes.
export async function loadFeedItems(): Promise<BlogFeedItem[]> {
  const posts = await fetchPosts();
  const contentHtml = await Promise.all(
    posts.map((p) => fetchPostContentHtml(p.slug)),
  );
  return posts.map((post, i) => ({
    slug: post.slug,
    title: post.title,
    url: `${SITE_URL}/blog/${post.slug}`,
    excerpt: toPlainExcerpt(post.contentExcerpt ?? "", EXCERPT_LEN),
    contentHtml: contentHtml[i],
    coverUrl: absoluteCover(post.coverImageUrl),
    tags: post.tags,
    authorName: post.authorName ?? FEED_AUTHOR,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
  }));
}

// Most-recent updatedAt across the feed, as an epoch ms value; falls back to
// null when the feed is empty so callers can pick their own "now".
export function feedLastModifiedMs(items: BlogFeedItem[]): number | null {
  if (items.length === 0) return null;
  const stamps = items
    .map((i) => Date.parse(i.updatedAt))
    .filter((n) => !Number.isNaN(n));
  return stamps.length > 0 ? Math.max(...stamps) : null;
}
