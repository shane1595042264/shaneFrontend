"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { listPosts, type BlogPost } from "@/lib/api/blog";
import { InlineErrorState } from "@/components/inline-error-state";
import { PostCard } from "./post-card";

const PAGE_SIZE = 24;
const SEARCH_DEBOUNCE_MS = 300;

// Heights are deliberately uneven so the skeleton reads as a masonry grid
// rather than a card grid that later reflows.
const SKELETON_HEIGHTS = [180, 240, 150, 210, 280, 170];

function collectTags(posts: BlogPost[]): string[] {
  const seen = new Set<string>();
  for (const p of posts) for (const t of p.tags) seen.add(t);
  return [...seen].sort((a, b) => a.localeCompare(b));
}

interface Props {
  /** First page, fetched during ISR so the document ships with real prose. */
  initialPosts: BlogPost[];
  initialNextCursor: string | null;
}

/**
 * The /blog reading surface: a left tab rail beside a Pinterest-style masonry.
 *
 * Masonry is CSS multi-column (`columns-*` + `break-inside-avoid` on the tile)
 * rather than a JS layout library — no new dependency, and it lays out in the
 * server-rendered HTML instead of after hydration. Tile height comes from
 * excerpt length until cover images arrive in Phase 3.
 *
 * Tag and search filtering round-trip to the backend (`?tag=`, `?q=`) instead
 * of filtering the loaded page, so they search the whole archive rather than
 * just the first 24 posts. The tag rail is the union of every tag seen so far
 * and never shrinks while you are on the page: filtering to one tag returns
 * posts carrying only that tag, and a rail rebuilt from that response would
 * collapse to a single tab with no way back.
 */
export function BlogIndex({ initialPosts, initialNextCursor }: Props) {
  const [posts, setPosts] = useState<BlogPost[]>(initialPosts);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [knownTags, setKnownTags] = useState<string[]>(() => collectTags(initialPosts));
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  // The server already handed us the unfiltered first page, so the mount pass
  // of the filter effect below would re-fetch exactly what we have.
  const skipInitialFetch = useRef(true);

  const mergeTags = (rows: BlogPost[]) =>
    setKnownTags((prev) => {
      const merged = new Set(prev);
      for (const p of rows) for (const t of p.tags) merged.add(t);
      return [...merged].sort((a, b) => a.localeCompare(b));
    });

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    listPosts({
      tag: activeTag,
      q: debouncedQuery || null,
      limit: PAGE_SIZE,
      signal: controller.signal,
    })
      .then((page) => {
        setPosts(page.posts);
        setNextCursor(page.nextCursor);
        mergeTags(page.posts);
      })
      .catch((e: unknown) => {
        // An aborted request is a superseded keystroke, not a failure.
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : "Failed to load posts");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [activeTag, debouncedQuery, reloadNonce]);

  const loadMore = () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    listPosts({
      tag: activeTag,
      q: debouncedQuery || null,
      cursor: nextCursor,
      limit: PAGE_SIZE,
    })
      .then((page) => {
        setPosts((prev) => [...prev, ...page.posts]);
        setNextCursor(page.nextCursor);
        mergeTags(page.posts);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load more posts"),
      )
      .finally(() => setLoadingMore(false));
  };

  const isFiltered = activeTag !== null || debouncedQuery !== "";

  const tabs = useMemo(
    () => [{ label: "All posts", value: null as string | null }, ...knownTags.map((t) => ({ label: t, value: t }))],
    [knownTags],
  );

  if (error && posts.length === 0) {
    return (
      <InlineErrorState
        message={error}
        onRetry={() => setReloadNonce((n) => n + 1)}
        backHref="/"
        backLabel="Back to Table"
      />
    );
  }

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
      <aside className="lg:w-52 lg:shrink-0">
        <div className="space-y-4 lg:sticky lg:top-8">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search posts…"
            aria-label="Search posts"
            // 100 is the backend's own cap on `q`; enforcing it here turns a
            // 400 into an input that simply stops accepting characters.
            maxLength={100}
            className="min-h-11 w-full rounded-md border border-white/15 bg-black/40 px-3 text-sm text-white placeholder:text-gray-400 focus:border-white/40 focus:outline-none"
          />
          <nav aria-label="Filter posts by tag">
            <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-0 lg:overflow-x-visible lg:pb-0">
              {tabs.map((tab) => {
                const active = activeTag === tab.value;
                return (
                  <li key={tab.value ?? "__all"} className="shrink-0 lg:shrink">
                    <button
                      type="button"
                      onClick={() => setActiveTag(tab.value)}
                      aria-current={active ? "true" : undefined}
                      className={`min-h-11 w-full whitespace-nowrap rounded-md border px-3 text-left text-sm transition-colors lg:rounded-none lg:border-0 lg:border-l-2 lg:px-3 ${
                        active
                          ? "border-white/40 bg-white/10 text-white lg:border-l-white"
                          : "border-white/10 text-gray-400 hover:text-white lg:border-l-white/10 lg:hover:border-l-white/40"
                      }`}
                    >
                      {tab.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Non-fatal failure with posts still on screen — the empty-state path
            above owns the case where there is nothing left to read. */}
        {error && posts.length > 0 && (
          <p role="alert" className="mb-4 text-sm text-red-400">
            {error}
          </p>
        )}

        {loading ? (
          <div className="columns-1 gap-5 sm:columns-2 xl:columns-3">
            {SKELETON_HEIGHTS.map((h, i) => (
              <div
                key={i}
                style={{ height: h }}
                className="mb-5 animate-pulse break-inside-avoid rounded-lg border border-white/10 bg-white/[0.04]"
              />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <p className="text-sm text-gray-400">
            {isFiltered
              ? "No posts match that filter."
              : "No posts yet. The first one is being written."}
          </p>
        ) : (
          <>
            <div className="columns-1 gap-5 sm:columns-2 xl:columns-3">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
            {nextCursor && (
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="mt-2 min-h-11 w-full rounded-md border border-white/15 px-4 text-sm text-gray-200 transition-colors hover:bg-white/5 disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
