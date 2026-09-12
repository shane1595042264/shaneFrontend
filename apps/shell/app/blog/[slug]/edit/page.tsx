"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { AuthorOnly } from "@/components/blog/author-only";
import { PostEditor } from "@/components/blog/post-editor";
import { getPost, type BlogPostDetail } from "@/lib/api/blog";

/**
 * SHAN-487. Loads the post with the author's JWT attached and hands it to the
 * shared editor. Client-rendered so a draft is actually visible: the backend
 * only reveals a draft to its own author, and an SSR fetch carries no identity
 * at all.
 */
function EditForm() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [post, setPost] = useState<BlogPostDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
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
  }, [slug]);

  if (state === "loading") {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8" aria-busy={true}>
        <div role="status" aria-label="Loading post editor">
          <span className="sr-only">Loading post editor…</span>
          <div className="h-3 w-28 animate-pulse rounded bg-white/[0.08]" />
          <div className="mt-3 mb-6 h-7 w-44 animate-pulse rounded bg-white/[0.08]" />
          <div className="h-64 w-full animate-pulse rounded border border-white/10 bg-white/[0.08]" />
        </div>
      </div>
    );
  }

  if (state !== "ready" || !post) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 text-sm text-gray-400">
        <Link href="/blog" className="text-gray-400 hover:text-white">
          &larr; back to blog
        </Link>
        <p className="mt-4">
          {state === "missing" ? "No such post." : (error ?? "Failed to load this post.")}
        </p>
      </div>
    );
  }

  // Writes are author-scoped on the backend (403 on edit), so showing a
  // stranger the form would only produce a failure at save time.
  if (post.post.authorId !== user?.id) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 text-sm text-gray-400">
        <Link href={`/blog/${slug}`} className="text-gray-400 hover:text-white">
          &larr; back to post
        </Link>
        <p className="mt-4">Only the author can edit this post.</p>
      </div>
    );
  }

  return <PostEditor existing={post} />;
}

export default function EditBlogPostPage() {
  return (
    <AuthorOnly prompt="Sign in to edit this post.">
      <EditForm />
    </AuthorOnly>
  );
}
