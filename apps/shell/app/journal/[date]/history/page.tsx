// apps/shell/app/journal/[date]/history/page.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "@/components/transition-link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { listVersions, getVersion, getEntry, revertEntry, type JournalVersion } from "@/lib/api/journal";
import { RelativeTime } from "@/lib/format-time";
import { humanizeError } from "@/lib/humanize-error";
import { FocusTrappedDiv } from "@/components/focus-trapped-div";
import { SuggestionDiff } from "@/components/journal/suggestion-diff";
import { LoadError } from "@/components/load-error";

// One page of history. Version rows are metadata only since SHAN-461, so a page
// costs the same whether the bodies behind it are 200 bytes or 100k.
const PAGE_SIZE = 25;

/** Per-version body, fetched only when a reader expands that version. */
type BodyState =
  | { status: "loading" }
  | { status: "ready"; content: string }
  | { status: "error"; message: string };

/** What an expanded row shows: the diff against its predecessor, or the raw body. */
type RowView = "changes" | "full";

export default function HistoryPage() {
  const params = useParams<{ date: string }>();
  const date = params.date;
  const { user } = useAuth();
  const [versions, setVersions] = useState<JournalVersion[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [bodies, setBodies] = useState<Record<number, BodyState>>({});
  // Versions are immutable, so a fetched body stays valid for the page lifetime
  // and a revert never invalidates it. The ref stops a double toggle in one tick
  // from firing two requests before `bodies` has re-rendered.
  const inFlight = useRef<Set<number>>(new Set());
  const [rowViews, setRowViews] = useState<Record<number, RowView>>({});
  const [authorId, setAuthorId] = useState<string | null>(null);
  const [currentNum, setCurrentNum] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reverting, setReverting] = useState<number | null>(null);
  const [revertConfirmTarget, setRevertConfirmTarget] = useState<number | null>(null);
  const [revertError, setRevertError] = useState<string | null>(null);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // SHAN-634: a failed load used to render "No versions found for this date."
  // with the raw error at the foot of the page and nothing to click.
  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([listVersions(date, { limit: PAGE_SIZE }), getEntry(date)])
      .then(([page, entry]) => {
        setVersions(page.versions);
        setNextCursor(page.nextCursor);
        if (entry) {
          setAuthorId(entry.entry.authorId);
          setCurrentNum(entry.currentVersionNum);
        }
      })
      .catch(() => setError("Could not load this entry's history."))
      .finally(() => setLoading(false));
  }, [date]);

  useEffect(load, [load]);

  const isAuthor = !!user && user.id === authorId;

  const loadBody = async (versionNum: number) => {
    if (bodies[versionNum]?.status === "ready") return;
    if (inFlight.current.has(versionNum)) return;
    inFlight.current.add(versionNum);
    setBodies((prev) => ({ ...prev, [versionNum]: { status: "loading" } }));
    try {
      const v = await getVersion(date, versionNum);
      setBodies((prev) => ({ ...prev, [versionNum]: { status: "ready", content: v.content } }));
    } catch (e) {
      setBodies((prev) => ({
        ...prev,
        [versionNum]: { status: "error", message: humanizeError(e, "Failed to load this version") },
      }));
    } finally {
      inFlight.current.delete(versionNum);
    }
  };

  // A row's default view is the diff, which needs the predecessor's body too.
  // versionNum is dense from 1 on the backend (createVersion writes
  // latest.versionNum + 1), so versionNum - 1 is guaranteed to exist for
  // versionNum > 1 and will not 404. loadBody dedupes, so the shared
  // predecessor of two adjacent expanded rows is only fetched once.
  const loadRow = (versionNum: number) => {
    const wanted = versionNum > 1 ? [versionNum - 1, versionNum] : [versionNum];
    return Promise.all(wanted.map((n) => loadBody(n)));
  };

  const loadMore = async () => {
    if (nextCursor === null || loadingMore) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await listVersions(date, { limit: PAGE_SIZE, cursor: nextCursor });
      setVersions((prev) => [...prev, ...page.versions]);
      setNextCursor(page.nextCursor);
    } catch (e) {
      setMoreError(humanizeError(e, "Failed to load older versions"));
    } finally {
      setLoadingMore(false);
    }
  };

  const requestRevert = (target: number) => {
    setRevertError(null);
    setRevertConfirmTarget(target);
  };

  const dismissRevert = () => {
    if (reverting !== null) return;
    setRevertConfirmTarget(null);
    setRevertError(null);
  };

  const refreshHistory = async () => {
    const [page, entry] = await Promise.all([listVersions(date, { limit: PAGE_SIZE }), getEntry(date)]);
    setVersions(page.versions);
    setNextCursor(page.nextCursor);
    if (entry) setCurrentNum(entry.currentVersionNum);
    setRefreshNotice(null);
  };

  const confirmRevert = async () => {
    if (revertConfirmTarget === null || currentNum === null) return;
    const target = revertConfirmTarget;
    setReverting(target);
    setRevertError(null);
    setRefreshNotice(null);
    let landed: number;
    try {
      landed = (await revertEntry(date, target, currentNum)).versionNum;
    } catch (e: any) {
      if (e.message === "VERSION_CONFLICT") {
        const cur = (e as any).currentVersionNum;
        setRevertError(
          cur !== undefined
            ? `Someone else edited the entry (now v${cur}). Refresh and try again.`
            : "Someone else edited the entry. Refresh and try again."
        );
      } else {
        setRevertError(e.message ?? "Revert failed");
      }
      setReverting(null);
      return;
    }
    // SHAN-608: the revert has landed, so the dialog closes and currentNum
    // moves now. The refresh below is a second request that can fail on its
    // own; if it shared the revert's catch, the author would see a failure for
    // a write that committed, and a retry would send the stale X-If-Match and
    // 409 as "someone else edited" when the only other edit was theirs.
    setCurrentNum(landed);
    setRevertConfirmTarget(null);
    setReverting(null);
    try {
      await refreshHistory();
    } catch {
      setRefreshNotice(`Reverted to v${target} (now v${landed}), but the history could not refresh.`);
    }
  };

  const retryRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshHistory();
    } catch {
      // The notice stays up; the reader can try again.
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (revertConfirmTarget === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && reverting === null) {
        setRevertConfirmTarget(null);
        setRevertError(null);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [revertConfirmTarget, reverting]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href={`/journal/${date}`} className="text-sm text-gray-400 hover:text-gray-300">
        ← back to entry
      </Link>
      <h1 className="mt-3 mb-4 font-mono text-2xl">
        {date} — history
      </h1>

      {refreshNotice && (
        <p role="status" className="mb-4 text-sm text-gray-300">
          {refreshNotice}{" "}
          <button
            type="button"
            onClick={() => void retryRefresh()}
            disabled={refreshing}
            className="underline hover:text-white disabled:opacity-50"
          >
            {refreshing ? "Reloading…" : "Reload"}
          </button>
        </p>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading versions…</p>
      ) : error ? (
        <LoadError message={error} onRetry={load} />
      ) : versions.length === 0 ? (
        <p className="text-sm text-gray-400">No versions found for this date.</p>
      ) : (
        <ul className="divide-y divide-white/10 rounded-md border border-white/10">
          {versions.map((v) => {
            const isCurrent = v.versionNum === currentNum;
            const body = bodies[v.versionNum];
            // v1 has nothing before it, so there is no diff to show — that row
            // stays a plain body view with no toggle.
            const hasPrev = v.versionNum > 1;
            const prevBody = hasPrev ? bodies[v.versionNum - 1] : undefined;
            const view: RowView = hasPrev ? rowViews[v.versionNum] ?? "changes" : "full";
            // In diff mode both bodies have to land before anything renders, and
            // either one failing is the row's error.
            const pending: (BodyState | undefined)[] = view === "changes" ? [prevBody, body] : [body];
            const failure = pending.find(
              (s): s is Extract<BodyState, { status: "error" }> => s?.status === "error"
            );
            const ready = pending.every((s) => s?.status === "ready");
            return (
              <li key={v.id} className="p-4">
                <div className="flex items-baseline justify-between">
                  <div className="flex items-baseline gap-2 text-sm">
                    <span className="font-mono">v{v.versionNum}</span>
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
                    {v.editor?.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={v.editor.avatarUrl}
                        alt=""
                        className="h-4 w-4 rounded-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : null}
                    <span className="text-gray-400">{v.editor?.name?.trim() || "Anonymous"}</span>
                    <span>·</span>
                    <RelativeTime iso={v.createdAt} />
                  </span>
                </div>
                <details
                  className="mt-3"
                  onToggle={(e) => {
                    if (e.currentTarget.open) void loadRow(v.versionNum);
                  }}
                >
                  <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-300">
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
                          {mode === "changes" ? `changes since v${v.versionNum - 1}` : "full content"}
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
                      {view === "changes" ? "Loading changes..." : "Loading content..."}
                    </p>
                  ) : view === "changes" && prevBody?.status === "ready" && body?.status === "ready" ? (
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
                    onClick={() => requestRevert(v.versionNum)}
                    disabled={reverting !== null}
                    className="mt-3 text-xs text-blue-400 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {reverting === v.versionNum ? "Reverting…" : "Revert to this version"}
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
            {loadingMore ? "Loading..." : "Load older versions"}
          </button>
          {moreError && (
            <p role="alert" className="mt-2 text-xs text-red-400">
              {moreError}
            </p>
          )}
        </div>
      )}

      {revertConfirmTarget !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={dismissRevert}
          role="dialog"
          aria-modal="true"
          aria-labelledby="revert-confirm-heading"
          aria-describedby="revert-confirm-body"
        >
          <FocusTrappedDiv
            className="bg-gray-900 border border-white/10 rounded-lg p-6 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="revert-confirm-heading" className="text-lg font-semibold text-white mb-2">
              Revert to v{revertConfirmTarget}?
            </h3>
            <p id="revert-confirm-body" className="text-sm text-gray-400 mb-4">
              A new version will be created with v{revertConfirmTarget}&apos;s content. The current version stays in history; this is publicly visible to other readers.
            </p>
            {revertError && (
              <p role="alert" className="mb-4 text-sm text-red-400">{revertError}</p>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={dismissRevert}
                disabled={reverting !== null}
                className="px-4 py-2 text-sm bg-white/5 hover:bg-white/10 disabled:opacity-50 text-gray-400 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRevert}
                disabled={reverting !== null}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded transition-colors"
              >
                {reverting !== null ? "Reverting..." : "Revert"}
              </button>
            </div>
          </FocusTrappedDiv>
        </div>
      )}
    </div>
  );
}
