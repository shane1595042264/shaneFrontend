"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getBlogReadingPosition,
  listBlogReadingPositions,
  saveBlogReadingPosition,
  type BlogReadingPosition,
} from "@/lib/api/blog-reading";
import { readLocal, ReadingTracker, type ReadingRemote } from "@/components/reading/reading-tracker";
import { ReadingProgress } from "@/components/reading/reading-progress";

// SHAN-705: the journal's resume-where-you-left-off, on the blog. Unlike the
// journal, most blog readers are not signed in, so a signed-out reader keeps
// their place on this device only; signed in, it syncs across devices through
// /api/blog/reading exactly as the journal does.

const ANON = "anon";
const keyFor = (who: string, slug: string) => `shane:blog-reading:${who}:${slug}`;

/**
 * The post's <article>, with the reading tracker on it. A client component so
 * the tracker can hold a ref to the article, but it renders the same element
 * the server page did around the same server-rendered children, so the cached
 * HTML is unchanged for every visitor.
 */
export function BlogReadingArticle({
  slug,
  title,
  className,
  children,
}: {
  slug: string;
  title: string;
  className?: string;
  children: ReactNode;
}) {
  const articleRef = useRef<HTMLElement>(null);
  const { user, loading } = useAuth();
  const who = user?.id ?? ANON;
  const remote: ReadingRemote | null = user
    ? {
        get: () => getBlogReadingPosition(slug),
        save: (pos, opts) => saveBlogReadingPosition(slug, pos, opts),
      }
    : null;
  return (
    <>
      <article ref={articleRef} className={className}>
        {children}
      </article>
      <ReadingTracker
        // Wait for auth: starting as a signed-out reader and restarting once
        // the session loads would restore twice.
        id={loading ? null : slug}
        localKey={keyFor(who, slug)}
        localMeta={{ slug, title }}
        remote={remote}
        noun="post"
        articleRef={articleRef}
      />
      <ReadingProgress articleRef={articleRef} />
    </>
  );
}

/** Every post this device has a signed-out position for, most recent first. */
function localPositions(): BlogReadingPosition[] {
  const out: BlogReadingPosition[] = [];
  const prefix = keyFor(ANON, "");
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      const copy = readLocal(key);
      if (!copy?.meta?.slug) continue;
      out.push({
        slug: copy.meta.slug,
        title: copy.meta.title ?? copy.meta.slug,
        progress: copy.progress,
        anchor: copy.anchor,
        updatedAt: new Date(copy.savedAt).toISOString(),
      });
    }
  } catch {
    // Storage blocked: nothing to resume, which the page handles.
  }
  return out.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

/**
 * The reader's positions for the blog index: synced ones when signed in, this
 * device's when not. Empty until known, and on any failure, so the index
 * renders exactly as before for anyone with nothing to resume.
 */
export function useBlogReadingPositions(): BlogReadingPosition[] {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;
  const [positions, setPositions] = useState<BlogReadingPosition[]>([]);
  useEffect(() => {
    if (loading) return;
    if (!userId) {
      setPositions(localPositions());
      return;
    }
    let cancelled = false;
    listBlogReadingPositions(100)
      .then((p) => !cancelled && setPositions(p))
      .catch(() => !cancelled && setPositions([]));
    return () => {
      cancelled = true;
    };
  }, [loading, userId]);
  return positions;
}
