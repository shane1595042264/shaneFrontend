"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { FocusTrappedDiv } from "@/components/focus-trapped-div";
import { deletePost } from "@/lib/api/blog";

/**
 * SHAN-487. Author-only controls on the post page.
 *
 * A client island inside an ISR Server Component: the page itself stays cached
 * and crawlable, and this renders nothing at all until the browser resolves who
 * is reading. Gated on `useAuth().user`, not on a token being present in
 * localStorage — a revoked token still sits there and /api/auth/me answers 200
 * with `{user: null}`, so a presence check would show controls whose every
 * write 401s (SHAN-463).
 */
export function PostActions({ slug, authorId }: { slug: string; authorId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!confirmOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !deleting) setConfirmOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmOpen, deleting]);

  if (!user || user.id !== authorId) return null;

  const confirmDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deletePost(slug);
      router.push("/blog");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
      setDeleting(false);
    }
  };

  return (
    <div className="mt-5 flex flex-wrap items-center gap-2">
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
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="inline-flex min-h-9 items-center rounded border border-red-500/40 px-3 text-xs text-red-300 hover:bg-red-500/10"
      >
        Delete
      </button>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => {
            if (!deleting) setConfirmOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="blog-delete-heading"
          aria-describedby="blog-delete-body"
        >
          <FocusTrappedDiv
            className="mx-4 w-full max-w-sm rounded-lg border border-white/10 bg-gray-900 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="blog-delete-heading" className="mb-2 text-lg font-semibold text-white">
              Delete this post?
            </h3>
            <p id="blog-delete-body" className="mb-4 text-sm text-gray-400">
              It disappears from the blog, the feeds and the sitemap immediately. The row and
              its full history are kept, so this is recoverable from the database — but not
              from this page.
            </p>
            {error && (
              <p role="alert" className="mb-4 text-sm text-red-400">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={deleting}
                className="rounded bg-white/5 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-white/10 disabled:opacity-50"
              >
                Keep it
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={deleting}
                className="rounded bg-red-600 px-4 py-2 text-sm text-white transition-colors hover:bg-red-500 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </FocusTrappedDiv>
        </div>
      )}
    </div>
  );
}
