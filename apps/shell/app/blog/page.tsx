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

export default async function BlogIndexPage() {
  const page = await fetchFirstPage();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Shane's Blog",
    url: `${SITE_URL}/blog`,
    author: { "@type": "Person", name: "Shane Li", url: SITE_URL },
    blogPost: page.posts.slice(0, 20).map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      url: `${SITE_URL}/blog/${p.slug}`,
      datePublished: p.publishedAt,
      dateModified: p.updatedAt,
      ...(p.tags.length ? { keywords: p.tags.join(", ") } : {}),
    })),
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
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
      </header>

      <BlogIndex initialPosts={page.posts} initialNextCursor={page.nextCursor} />
    </main>
  );
}
