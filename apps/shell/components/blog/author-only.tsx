"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

/**
 * SHAN-487. The shared gate for the blog's authoring routes. Renders a skeleton
 * while auth resolves, a sign-in prompt for anonymous visitors, and the form
 * only once we have a user.
 *
 * Gated on `useAuth().user`, never on "a token exists in localStorage": a
 * revoked token still sits in storage and /api/auth/me answers 200 with
 * `{user: null}` rather than 401, so a token-presence check happily renders a
 * form whose every write 401s (SHAN-463).
 */
export function AuthorOnly({
  children,
  backHref = "/blog",
  backLabel = "back to blog",
  prompt = "Sign in to write.",
}: {
  children: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  prompt?: string;
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8" aria-busy={true}>
        <div role="status" aria-label="Loading">
          <span className="sr-only">Loading…</span>
          <div className="h-3 w-28 animate-pulse rounded bg-white/[0.08]" />
          <div className="mt-3 mb-6 h-7 w-44 animate-pulse rounded bg-white/[0.08]" />
          <div className="h-64 w-full animate-pulse rounded border border-white/10 bg-white/[0.08]" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 text-sm text-gray-400">
        <Link href={backHref} className="text-gray-400 hover:text-white">
          &larr; {backLabel}
        </Link>
        <p className="mt-4">{prompt}</p>
      </div>
    );
  }

  return <>{children}</>;
}
