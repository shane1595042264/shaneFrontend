"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { RelativeTime } from "@/lib/format-time";
import { FocusTrappedDiv } from "@/components/focus-trapped-div";
import { SuggestionDiff } from "@/components/journal/suggestion-diff";
import {
  getPost,
  getPostVersion,
  listPostVersions,
  revertPost,
  type BlogVersion,
  type VersionConflict,
} from "@/lib/api/blog";

const PAGE_SIZE = 25;

/** Per-version body, fetched only when a reader expands that version. */
type BodyState =
  | { status: "loading" }
  | { status: "ready"; content: string }
  | { status: "error"; message: string };

/** What an expanded row shows: the diff against its predecessor, or the raw body. */
type RowView = "changes" | "full";

/**
 * SHAN-487. The blog's revision history, modelled on the journal's
 * /journal/[date]/history — same lazy per-version body fetch, same diff/full
 * toggle, same confirm-then-revert with a 409 path.
 *
 * Two blog-specific bits: version rows carry a `title` (renaming a post is an
 * edit here, unlike the date-titled journal), and reads are public, so anyone
 * can read the history while only the author sees a Revert control.
 */
export default function BlogHistoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();

  const [versions, setVersions] = useState<BlogVersion[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [authorId, setAuthorId] = useState<string | null>(null);
  const [currentNum, setCurrentNum] = useState<number | null>(null);
  const [postTitle, setPostTitle] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);

  const [bodies, setBodies] = useState<Record<number, BodyState>>({});
  // Versions are immutable, so a fetched body stays valid for the page's
  // lifetime and a revert never invalidates it. The ref stops a double toggle
  // in one tick from firing two requests before `bodies` has re-rendered.
  const inFlight = useRef<Set<number>>(new Set());
  const [rowViews, setRowViews] = useState<Record<number, RowView>>({});

  const [revertTarget, setRevertTarget] = useState<number | null>(null);
  const [reverting, setReverting] = useState(false);
  const [revertError, setRevertError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([listPostVersions(slug, { limit: PAGE_SIZE }), getPost(slug)])
      .then(([page, post]) => {
        if (cancelled) return;
        setVersions(page.versions);
        setNextCursor(page.nextCursor);
        if (post) {
          setAuthorId(post.post.authorId);
          setCurrentNum(post.currentVersionNum);
          setPostTitle(post.title);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load history");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const isAuthor = !!user && user.id === authorId;

  const loadBody = async (versionNum: number) => {
    if (bodies[versionNum]?.status === "ready") return;
    if (inFlight.current.has(versionNum)) return;
    inFlight.current.add(versionNum);
    setBodies((prev) => ({ ...prev, [versionNum]: { status: "loading" } }));
    try {
      const v = await getPostVersion(slug, versionNum);
      setBodies((prev) => ({ ...prev, [versionNum]: { status: "ready", content: v.content } }));
    } catch (e) {
      setBodies((prev) => ({
        ...prev,
        [versionNum]: {
          status: "error",
          message: e instanceof Error ? e.message : "Failed to load this version",
        },
      }));
    } finally {
      inFlight.current.delete(versionNum);
    }
  };

  // A row's default view is the diff, which needs its predecessor's body too.
  // versionNum is dense from 1 on the backend, so versionNum - 1 always exists
  // for versionNum > 1. loadBody dedupes, so the shared predecessor of two
  // adjacent expanded rows is fetched once.
  const loadRow = (versionNum: number) => {
    const wanted = versionNum > 1 ? [versionNum - 1, versionNum] : [versionNum];
    return Promise.all(wanted.map((n) => loadBody(n)));
  };

  const loadMore = async () => {
    if (nextCursor === null || loadingMore) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await listPostVersions(slug, { limit: PAGE_SIZE, cursor: nextCursor });
      setVersions((prev) => [...prev, ...page.versions]);
      setNextCursor(page.nextCursor);
    } catch (e) {
      setMoreError(e instanceof Error ? e.message : "Failed to load older versions");
    } finally {
      setLoadingMore(false);
    }
  };

  const confirmRevert = async () => {
    if (revertTarget === null || currentNum === null) return;
    setReverting(true);
    setRevertError(null);
    try {
      await revertPost(slug, revertTarget, currentNum);
      const [page, post] = await Promise.all([
        listPostVersions(slug, { limit: PAGE_SIZE }),
        getPost(slug),
      ]);
      setVersions(page.versions);
      setNextCursor(page.nextCursor);
      if (post) {
        setCurrentNum(post.currentVersionNum);
        setPostTitle(post.title);
      }
      setRevertTarget(null);
    } catch (e) {
      const err = e as VersionConflict;
      if (err?.message === "VERSION_CONFLICT") {
        setRevertError(
          err.currentVersionNum !== undefined
            ? `Someone else edited this post (it is on v${err.currentVersionNum} now). Reload and try again.`
            : "Someone else edited this post. Reload and try again.",
        );
      } else {
        setRevertError(e instanceof Error ? e.message : "Revert failed");
      }
    } finally {
      setReverting(false);
    }
  };

  useEffect(() => {
    if (revertTarget === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !reverting) {
        setRevertTarget(null);
        setRevertError(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [revertTarget, reverting]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href={`/blog/${slug}`} className="text-sm text-gray-400 hover:text-white">
        &larr; back to post
      </Link>
      <h1 className="mt-3 mb-1 text-2xl font-semibold tracking-tight text-white">History</h1>
      {postTitle && <p className="mb-5 text-sm text-gray-400">{postTitle}</p>}

      {loading ? (
        <p className="text-sm text-gray-400">Loading versions…</p>
      ) : error ? (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      ) : versions.length === 0 ? (
        <p className="text-sm text-gray-400">No versions found for this post.</p>
      ) : (
        <ul className="divide-y divide-white/10 rounded-md border border-white/10">
          {versions.map((v) => {
            const isCurrent = v.versionNum === currentNum;
            const body = bodies[v.versionNum];
            const hasPrev = v.versionNum > 1;
            const prevBody = hasPrev ? bodies[v.versionNum - 1] : undefined;
            const view: RowView = hasPrev ? (rowViews[v.versionNum] ?? "changes") : "full";
            const pending: (BodyState | undefined)[] =
              view === "changes" ? [prevBody, body] : [body];
            const failure = pending.find(
              (s): s is Extract<BodyState, { status: "error" }> => s?.status === "error",
            );
            const ready = pending.every((s) => s?.status === "ready");
            return (
              <li key={v.id} className="p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2 text-sm">
                    <span className="font-mono text-white">v{v.versionNum}</span>
                    <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-gray-400">
                      {v.source}
                    </span>
                    {isCurrent && (
                      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-emerald-300">
                        current
                      </span>
                    )}
                  </div>
                  <span className="flex items-center gap-1.5 text-xs text-gray-400">
                    <span>{v.editor?.name?.trim() || "Anonymous"}</span>
                    <span aria-hidden="true">·</span>
                    <RelativeTime iso={v.createdAt} />
                  </span>
                </div>

                {/* Titles are versioned on the blog, so show which one this
                    revision carried — a rename is otherwise invisible here. */}
                <p className="mt-1 text-sm text-gray-300">{v.title}</p>

                <details
                  className="mt-3"
                  onToggle={(e) => {
                    if (e.currentTarget.open) void loadRow(v.versionNum);
                  }}
                >
                  <summary className="cursor-pointer text-xs text-gray-400 hover:text-white">
                    {hasPrev ? "view changes" : "view content"}
                  </summary>
                  {hasPrev && (
                    <div className="mt-2 flex gap-2 text-[11px]">
                      {(["changes", "full"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          aria-pressed={view === mode}
                          onClick={() => {
                            setRowViews((prev) => ({ ...prev, [v.versionNum]: mode }));
                            void loadRow(v.versionNum);
                          }}
                          className={`rounded border px-2 py-0.5 ${
                            view === mode
                              ? "border-white bg-white text-black"
                              : "border-white/20 text-gray-300 hover:bg-white/5"
                          }`}
                        >
                          {mode === "changes"
                            ? `changes since v${v.versionNum - 1}`
                            : "full content"}
                        </button>
                      ))}
                    </div>
                  )}
                  {failure ? (
                    <p role="alert" className="mt-2 text-xs text-red-400">
                      {failure.message}{" "}
                      <button
                        type="button"
                        onClick={() => void loadRow(v.versionNum)}
                        className="underline hover:text-red-300"
                      >
                        Retry
                      </button>
                    </p>
                  ) : !ready ? (
                    <p className="mt-2 text-xs text-gray-400">
                      {view === "changes" ? "Loading changes…" : "Loading content…"}
                    </p>
                  ) : view === "changes" &&
                    prevBody?.status === "ready" &&
                    body?.status === "ready" ? (
                    <div className="mt-2 max-h-80 overflow-y-auto">
                      <SuggestionDiff before={prevBody.content} after={body.content} />
                    </div>
                  ) : body?.status === "ready" ? (
                    <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded bg-black/30 p-3 font-mono text-xs text-white/80">
                      {body.content}
                    </pre>
                  ) : null}
                </details>

                {isAuthor && !isCurrent && (
                  <button
                    type="button"
                    onClick={() => {
                      setRevertError(null);
                      setRevertTarget(v.versionNum);
                    }}
                    className="mt-3 text-xs text-blue-400 hover:text-blue-300"
                  >
                    Revert to this version
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {nextCursor !== null && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="rounded border border-white/10 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : "Load older versions"}
          </button>
          {moreError && (
            <p role="alert" className="mt-2 text-xs text-red-400">
              {moreError}
            </p>
          )}
        </div>
      )}

      {revertTarget !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => {
            if (!reverting) {
              setRevertTarget(null);
              setRevertError(null);
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="blog-revert-heading"
          aria-describedby="blog-revert-body"
        >
          <FocusTrappedDiv
            className="mx-4 w-full max-w-sm rounded-lg border border-white/10 bg-gray-900 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="blog-revert-heading" className="mb-2 text-lg font-semibold text-white">
              Revert to v{revertTarget}?
            </h3>
            <p id="blog-revert-body" className="mb-4 text-sm text-gray-400">
              A new version is appended carrying v{revertTarget}&apos;s title and body. Nothing
              is deleted — the current version stays in this history, and the cover image is
              left alone.
            </p>
            {revertError && (
              <p role="alert" className="mb-4 text-sm text-red-400">
                {revertError}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setRevertTarget(null);
                  setRevertError(null);
                }}
                disabled={reverting}
                className="rounded bg-white/5 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmRevert()}
                disabled={reverting}
                className="rounded bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
              >
                {reverting ? "Reverting…" : "Revert"}
              </button>
            </div>
          </FocusTrappedDiv>
        </div>
      )}
    </main>
  );
}
