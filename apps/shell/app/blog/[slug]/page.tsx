import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PostBody } from "@/components/blog/post-body";
import type { BlogPostDetail } from "@/lib/api/blog";
import { readingTimeMinutes, toPlainExcerpt } from "@/lib/journal-text";
import { API_URL } from "@/lib/api-url";

const SITE_URL = "https://shanejli.com";

// ISR like the index. Posts are append-only revisions, so a 5-minute window
// between an edit landing and the cached page catching up is acceptable; the
// authoring UI in Phase 3 will revalidate on write the way journal does.
export const revalidate = 300;

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
  const ogImagePath = `/blog/${slug}/opengraph-image`;
  return {
    title,
    description,
    // Re-declared rather than inherited: app/blog/layout.tsx sets a canonical
    // for the index, and a nested route that doesn't override it would claim
    // /blog as its own canonical (SHAN-464).
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Shane — Periodic Table of Life",
      type: "article",
      publishedTime: data.post.publishedAt,
      modifiedTime: data.post.updatedAt,
      tags: data.post.tags,
      images: [ogImagePath],
    },
    twitter: { card: "summary_large_image", title, description, images: [ogImagePath] },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await fetchPost(slug);
  if (!data) notFound();

  const { post, author, title, content } = data;
  const minutes = readingTimeMinutes(content);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    url: `${SITE_URL}/blog/${slug}`,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: { "@type": "Person", name: author?.name ?? "Shane Li", url: SITE_URL },
    ...(post.tags.length ? { keywords: post.tags.join(", ") } : {}),
    description: toPlainExcerpt(content, 200, "…"),
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/blog/${slug}` },
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdSafe(jsonLd) }}
      />

      <Link href="/blog" className="text-sm text-gray-400 hover:text-white">
        &larr; Back to blog
      </Link>

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
        {post.tags.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {post.tags.map((tag) => (
              <li
                key={tag}
                className="rounded border border-white/10 px-2 py-0.5 text-xs text-gray-400"
              >
                {tag}
              </li>
            ))}
          </ul>
        )}
      </header>

      <article className="mt-8">
        <PostBody content={content} />
      </article>
    </main>
  );
}
