"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { PostBody } from "@/components/blog/post-body";
import { coverSrc, getPost, type BlogPostDetail } from "@/lib/api/blog";
import { readingTimeMinutes } from "@/lib/journal-text";

/**
 * SHAN-487. The draft reading surface.
 *
 * Why this route exists at all: /blog/<slug> is checked at the edge by
 * middleware, which HEADs the backend anonymously (the JWT lives in
 * localStorage, so the edge has no identity to forward). The backend hides
 * drafts from anonymous callers, so an author opening their own draft URL got a
 * hard 404 before Next ever rendered. The fix is a separate two-segment path
 * that the middleware slug branch cannot match, fetched client-side with the
 * author's token — NOT a pass-through allowlist entry for /blog/<something>,
 * which is the SHAN-460 soft-404 trap.
 *
 * Published posts land here too (from a draft that was published in another
 * tab, say), and just get pointed at their real, cacheable, indexable URL.
 */
export default function BlogPreviewPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useAuth();
  const [post, setPost] = useState<BlogPostDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Wait for auth: fetching before the token is readable would ask
    // anonymously and get the 404 this page exists to avoid.
    if (authLoading) return;
    let cancelled = false;
    setState("loading");
    getPost(slug)
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setState("missing");
          return;
        }
        setPost(data);
        setState("ready");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load this post");
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [slug, authLoading]);

  if (authLoading || state === "loading") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10" aria-busy={true}>
        <div role="status" aria-label="Loading preview">
          <span className="sr-only">Loading preview…</span>
          <div className="h-3 w-24 animate-pulse rounded bg-white/[0.08]" />
          <div className="mt-6 h-9 w-3/4 animate-pulse rounded bg-white/[0.08]" />
          <div className="mt-8 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-4 w-full animate-pulse rounded bg-white/[0.06]" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (state !== "ready" || !post) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 text-sm text-gray-400">
        <Link href="/blog" className="text-gray-400 hover:text-white">
          &larr; back to blog
        </Link>
        <p className="mt-4">
          {state === "missing"
            ? user
              ? "No such post, or it isn't yours to read."
              : "No such post. If this is your draft, sign in to read it."
            : (error ?? "Failed to load this post.")}
        </p>
      </main>
    );
  }

  const isAuthor = post.post.authorId === user?.id;
  const cover = coverSrc(post.post.coverImageUrl);
  const minutes = readingTimeMinutes(post.content);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/blog" className="text-sm text-gray-400 hover:text-white">
        &larr; Back to blog
      </Link>

      <div className="mt-6 rounded-md border border-amber-400/40 bg-amber-400/5 px-4 py-3 text-sm text-amber-200">
        {post.post.status === "draft" ? (
          <>
            Draft preview — nobody but you can see this. Publish it from the editor when it is
            ready.
          </>
        ) : (
          <>
            This post is published.{" "}
            <Link href={`/blog/${slug}`} className="underline hover:text-amber-100">
              Read it at its real URL
            </Link>
            .
          </>
        )}
      </div>

      {cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cover}
          alt=""
          className="mt-6 max-h-96 w-full rounded-lg border border-white/10 object-cover"
        />
      )}

      <header className="mt-6 border-b border-white/10 pb-6">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">
          {post.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-400">
          {post.author?.name && <span>{post.author.name}</span>}
          {minutes > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>{minutes} min read</span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span>v{post.currentVersionNum}</span>
        </div>
        {post.post.tags.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {post.post.tags.map((tag) => (
              <li
                key={tag}
                className="rounded border border-white/10 px-2 py-0.5 text-xs text-gray-400"
              >
                {tag}
              </li>
            ))}
          </ul>
        )}
        {isAuthor && (
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={`/blog/${slug}/edit`}
              className="inline-flex min-h-9 items-center rounded border border-white/20 px-3 text-xs text-gray-200 hover:bg-white/5"
            >
              Edit
            </Link>
            <Link
              href={`/blog/${slug}/history`}
              className="inline-flex min-h-9 items-center rounded border border-white/20 px-3 text-xs text-gray-200 hover:bg-white/5"
            >
              History
            </Link>
          </div>
        )}
      </header>

      <article className="mt-8">
        <PostBody content={post.content} />
      </article>
    </main>
  );
}
