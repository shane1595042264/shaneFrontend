import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PostBody } from "@/components/blog/post-body";
import { PostActions } from "@/components/blog/post-actions";
import { PostReactionBar } from "@/components/blog/post-reaction-bar";
import { BlogComments } from "@/components/blog/blog-comments";
import { coverSrc, type BlogPostDetail } from "@/lib/api/blog";
import { readingTimeMinutes, toPlainExcerpt } from "@/lib/journal-text";
import { API_URL } from "@/lib/api-url";

const SITE_URL = "https://shanejli.com";

// ISR like the index. The 300s window only ever applies to idle and crawler
// traffic now: every mutation in lib/api/blog.ts calls revalidateBlogPost
// (SHAN-487), so an author sees their own write on the next navigation.
export const revalidate = 300;

// SHAN-512: the export above was inert on its own. A dynamic segment with no
// generateStaticParams is never ISR-eligible, so Next kept marking this route
// ƒ and serving Cache-Control: no-store — the build table showed no Revalidate
// column for it while /courses/[slug] showed "5m". Listing the slugs
// prerenders the published posts; dynamicParams stays on (the default) so a
// post published afterwards still renders on demand and is cached from then
// on. Unauthenticated callers of this endpoint only ever get published rows,
// so a draft can never be baked into a shared cache. Failing soft to [] keeps
// a backend blip mid-deploy from failing the build — the same hazard
// /trips/page.tsx and /courses/[slug] document.
//
// The precondition this route satisfies and /journal/[date] does not: every
// fetch in the rendered tree is cacheable. fetchPost below passes
// next: { revalidate }, and the three interactive pieces (PostActions,
// PostReactionBar, BlogComments) are client islands, so nothing here reads
// request state. A single `cache: "no-store"` anywhere in a static route's
// tree throws "Page changed from static to dynamic at runtime" and 500s the
// page — which is exactly what it did to /journal/[date]; see the note there.
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    const res = await fetch(`${API_URL}/api/blog/posts?limit=100`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { posts: { slug: string }[] };
    return data.posts.map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  year: "numeric",
  month: "long",
  day: "numeric",
});

function formatPublished(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : dateFormatter.format(d);
}

function jsonLdSafe(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

// Null on 404 so both generateMetadata and the page render the not-found path.
// Anything else throws into blog/error.tsx rather than masquerading as a miss.
async function fetchPost(slug: string): Promise<BlogPostDetail | null> {
  const res = await fetch(`${API_URL}/api/blog/posts/${encodeURIComponent(slug)}`, {
    next: { revalidate },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load post: ${res.status}`);
  return (await res.json()) as BlogPostDetail;
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await fetchPost(slug).catch(() => null);
  if (!data) return { title: "Post not found", robots: { index: false, follow: true } };

  const title = `${data.title} — Blog — Shane`;
  const description =
    toPlainExcerpt(data.content, 160, "…") || "A post on Shane's blog.";
  const url = `${SITE_URL}/blog/${slug}`;
  return {
    title,
    description,
    // Re-declared rather than inherited: app/blog/layout.tsx sets a canonical
    // for the index, and a nested route that doesn't override it would claim
    // /blog as its own canonical (SHAN-464). `types` is restated for the same
    // reason in reverse — overriding `alternates` here would otherwise drop
    // the layout's feed autodiscovery from the page a reader is most likely to
    // subscribe from (SHAN-491).
    alternates: {
      canonical: url,
      types: {
        "application/rss+xml": "/blog/feed.xml",
        "application/feed+json": "/blog/feed.json",
      },
    },
    // No `images` key on purpose: the opengraph-image.tsx file convention emits
    // og:image plus :alt/:type/:width/:height and a cache-busting content hash,
    // and naming the route here would collapse all of that to one bare URL. See
    // lib/og-image-guard.ts, which fails the build if it comes back.
    openGraph: {
      title,
      description,
      url,
      siteName: "Shane — Periodic Table of Life",
      type: "article",
      publishedTime: data.post.publishedAt,
      modifiedTime: data.post.updatedAt,
      tags: data.post.tags,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await fetchPost(slug);
  if (!data) notFound();

  const { post, author, title, content } = data;
  const minutes = readingTimeMinutes(content);
  const cover = coverSrc(post.coverImageUrl);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    url: `${SITE_URL}/blog/${slug}`,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: { "@type": "Person", name: author?.name ?? "Shane Li", url: SITE_URL },
    ...(cover ? { image: cover } : {}),
    ...(post.tags.length ? { keywords: post.tags.join(", ") } : {}),
    description: toPlainExcerpt(content, 200, "…"),
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/blog/${slug}` },
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdSafe(jsonLd) }}
      />

      <Link href="/blog" className="text-sm text-gray-400 hover:text-white">
        &larr; Back to blog
      </Link>

      {cover && (
        // Plain <img> for the same reason as the masonry tile: the bytes come
        // from the backend host, which the image optimizer isn't configured
        // for. Decorative — the h1 below carries the meaning.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cover}
          alt=""
          className="mt-6 max-h-96 w-full rounded-lg border border-white/10 object-cover"
        />
      )}

      <header className="mt-6 border-b border-white/10 pb-6">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">
          {title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-400">
          <time dateTime={post.publishedAt}>{formatPublished(post.publishedAt)}</time>
          {author?.name && (
            <>
              <span aria-hidden="true">·</span>
              <span>{author.name}</span>
            </>
          )}
          {minutes > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>{minutes} min read</span>
            </>
          )}
          {post.editCount > 1 && (
            <>
              <span aria-hidden="true">·</span>
              <span>revised {post.editCount - 1}×</span>
            </>
          )}
          {post.status === "draft" && (
            <span className="rounded border border-amber-400/40 px-1.5 py-0.5 text-xs text-amber-300">
              draft — visible only to you
            </span>
          )}
        </div>
        {/* SHAN-493: links, not the inert spans on the index tiles. A tile is
            itself one big anchor, so a nested link there would be invalid HTML
            and steal the click; here there is no enclosing anchor, and a tag on
            the post you just read is the most natural "more like this". The
            layout's canonical points every ?tag= variant back at /blog, so this
            adds no indexable duplicate of the index. */}
        {post.tags.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {post.tags.map((tag) => (
              <li key={tag}>
                <Link
                  href={`/blog?tag=${encodeURIComponent(tag)}`}
                  className="block rounded border border-white/10 px-2 py-0.5 text-xs text-gray-400 transition-colors hover:border-white/30 hover:text-white"
                >
                  {tag}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {/* Client island: renders nothing until the browser resolves who is
            reading, so the cached HTML stays identical for every visitor. */}
        <PostActions slug={slug} authorId={post.authorId} />
      </header>

      <article className="mt-8">
        <PostBody content={content} />
      </article>

      {/* Both are client islands for the same reason PostActions is: the page
          stays a single cached document for every visitor, and who is reading
          is resolved in the browser afterwards. Reactions and comments are
          readable signed-out; only the write affordances differ. */}
      <div className="mt-8 border-t border-white/10 pt-6">
        <PostReactionBar slug={slug} />
      </div>

      <BlogComments slug={slug} postAuthorId={post.authorId} />

      {/* SHAN-495. Server-rendered rather than a client island, unlike the two
          blocks above: this is identical for every visitor, and its whole point
          is to be a crawlable internal link, which an effect-mounted one would
          not be. Older on the left, newer on the right, matching the reading
          direction of the index above it. Either side is dropped when the post
          sits at that end of the archive; when both are, so is the nav. */}
      {(data.prev || data.next) && (
        <nav
          aria-label="More posts"
          className="mt-10 grid gap-3 border-t border-white/10 pt-6 sm:grid-cols-2"
        >
          {data.prev ? (
            <Link
              href={`/blog/${data.prev.slug}`}
              rel="prev"
              className="group rounded-lg border border-white/10 px-4 py-3 transition-colors hover:border-white/30"
            >
              <span className="block text-xs uppercase tracking-wide text-gray-400">
                &larr; Older
              </span>
              <span className="mt-1 block text-sm font-medium text-gray-300 group-hover:text-white">
                {data.prev.title}
              </span>
            </Link>
          ) : (
            <span aria-hidden="true" className="hidden sm:block" />
          )}
          {data.next && (
            <Link
              href={`/blog/${data.next.slug}`}
              rel="next"
              className="group rounded-lg border border-white/10 px-4 py-3 transition-colors hover:border-white/30 sm:text-right"
            >
              <span className="block text-xs uppercase tracking-wide text-gray-400">
                Newer &rarr;
              </span>
              <span className="mt-1 block text-sm font-medium text-gray-300 group-hover:text-white">
                {data.next.title}
              </span>
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
