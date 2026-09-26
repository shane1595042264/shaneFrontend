import type { Metadata } from "next";
import { BlogIndex } from "@/components/blog/blog-index";
import { buildPostsQuery, type BlogPostPage } from "@/lib/api/blog";
import { API_URL } from "@/lib/api-url";

const SITE_URL = "https://shanejli.com";
const PAGE_SIZE = 24;

// ISR rather than force-dynamic: the blog is public, read-mostly and the index
// is the crawlable surface, so it should be served from cache and refreshed on
// a timer like the journal pages (5 min). Filtering, search and pagination all
// happen client-side against the API, so a stale-by-minutes first page costs
// nothing.
export const revalidate = 300;

// Escape `<` so a post title containing "</script>" can't break out of the
// JSON-LD tag. Same guard as trips/[slug] and courses/[slug].
function jsonLdSafe(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

// Swallow to an empty page rather than throwing: this route is prerendered, and
// a backend hiccup during a build shouldn't fail the deploy. The client-side
// BlogIndex re-fetches on any interaction, so a reader who lands on an empty
// cached page recovers by searching or picking a tab.
async function fetchFirstPage(): Promise<BlogPostPage> {
  try {
    const res = await fetch(
      `${API_URL}/api/blog/posts${buildPostsQuery({ limit: PAGE_SIZE })}`,
      { next: { revalidate } },
    );
    if (!res.ok) return { posts: [], nextCursor: null };
    return (await res.json()) as BlogPostPage;
  } catch {
    return { posts: [], nextCursor: null };
  }
}

/**
 * SHAN-524: an empty blog should not be offered to search engines as a page.
 *
 * Every published row was a trashed E2E fixture, so `/api/blog/posts` returns
 * `[]` on prod and the whole rendered body is the header plus "No posts yet."
 * That is a thin page, and a thin page that is both indexable and listed in
 * sitemap.xml is what Search Console reports as "Submitted URL seems to be a
 * soft 404" — a finding that counts against the sitemap as a whole, not just
 * the one URL. app/sitemap.ts drops the `/blog` entry on the same condition.
 *
 * Nothing here is a manual switch: the day a post ships, `posts.length` is
 * non-zero, this returns no `robots` value, and the route is indexable again.
 *
 * `follow` stays true because the page is thin, not private — the crawler
 * should still walk the nav links out of it.
 *
 * Returning `{}` in the normal case contributes nothing to the merge, so the
 * title, description, canonical, feed `alternates` and openGraph declared in
 * app/blog/layout.tsx survive untouched. That is the SHAN-464 rule read in the
 * other direction: `alternates` is replaced only by a segment that re-declares
 * it, and this one deliberately does not.
 *
 * The `fetchFirstPage()` call is shared with the render below rather than
 * doubled — Next dedupes identical `fetch`es within one render pass.
 */
export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchFirstPage();
  if (page.posts.length > 0) return {};
  return { robots: { index: false, follow: true } };
}

export default async function BlogIndexPage() {
  const page = await fetchFirstPage();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Shane's Blog",
    url: `${SITE_URL}/blog`,
    author: { "@type": "Person", name: "Shane Li", url: SITE_URL },
    // Omitted rather than emitted as `[]` when there is nothing to list: an
    // empty array is a positive claim that this Blog contains no posts, which
    // is the assertion the noindex above exists to avoid making.
    ...(page.posts.length
      ? {
          blogPost: page.posts.slice(0, 20).map((p) => ({
            "@type": "BlogPosting",
            headline: p.title,
            url: `${SITE_URL}/blog/${p.slug}`,
            datePublished: p.publishedAt,
            dateModified: p.updatedAt,
            ...(p.tags.length ? { keywords: p.tags.join(", ") } : {}),
          })),
        }
      : {}),
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdSafe(jsonLd) }}
      />

      <header className="mb-8 border-b border-white/10 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Blog</h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-400">
          Long-form writing, in the open. The journal next door is invite-only; this
          is the part anyone can read.
        </p>
        {/*
          SHAN-491: the feeds are autodiscoverable from <head>, but that only
          helps a reader whose browser already knows to look. A visible link is
          how a person subscribes. Plain <a>, not <Link>: these are route
          handlers, not pages, so there's nothing for the client router to
          prefetch.
        */}
        <p className="mt-3 text-sm text-gray-400">
          Subscribe:{" "}
          <a href="/blog/feed.xml" className="text-blue-400 hover:text-blue-300">
            RSS
          </a>{" "}
          &middot;{" "}
          <a href="/blog/feed.json" className="text-blue-400 hover:text-blue-300">
            JSON Feed
          </a>
        </p>
      </header>

      <BlogIndex initialPosts={page.posts} initialNextCursor={page.nextCursor} />
    </div>
  );
}
