// apps/shell/app/journal/[date]/history/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { listVersions, getEntry, revertEntry, type JournalVersion } from "@/lib/api/journal";
import { RelativeTime } from "@/lib/format-time";

export default function HistoryPage() {
  const params = useParams<{ date: string }>();
  const date = params.date;
  const { user } = useAuth();
  const [versions, setVersions] = useState<JournalVersion[]>([]);
  const [authorId, setAuthorId] = useState<string | null>(null);
  const [currentNum, setCurrentNum] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reverting, setReverting] = useState<number | null>(null);
  const [revertConfirmTarget, setRevertConfirmTarget] = useState<number | null>(null);
  const [revertError, setRevertError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([listVersions(date), getEntry(date)])
      .then(([vs, entry]) => {
        setVersions(vs);
        if (entry) {
          setAuthorId(entry.entry.authorId);
          setCurrentNum(entry.currentVersionNum);
        }
      })
      .catch((e) => setError(e.message ?? "Failed to load history"))
      .finally(() => setLoading(false));
  }, [date]);

  const isAuthor = !!user && user.id === authorId;

  const requestRevert = (target: number) => {
    setRevertError(null);
    setRevertConfirmTarget(target);
  };

  const dismissRevert = () => {
    if (reverting !== null) return;
    setRevertConfirmTarget(null);
    setRevertError(null);
  };

  const confirmRevert = async () => {
    if (revertConfirmTarget === null || currentNum === null) return;
    const target = revertConfirmTarget;
    setReverting(target);
    setRevertError(null);
    try {
      await revertEntry(date, target, currentNum);
      const [vs, entry] = await Promise.all([listVersions(date), getEntry(date)]);
      setVersions(vs);
      if (entry) setCurrentNum(entry.currentVersionNum);
      setRevertConfirmTarget(null);
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
    } finally {
      setReverting(null);
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
      <Link href={`/journal/${date}`} className="text-sm text-gray-500 hover:text-gray-300">
        ← back to entry
      </Link>
      <h1 className="mt-3 mb-4 font-mono text-2xl">
        {date} — history
      </h1>

      {loading ? (
        <p className="text-sm text-gray-400">Loading versions…</p>
      ) : versions.length === 0 ? (
        <p className="text-sm text-gray-400">No versions found for this date.</p>
      ) : (
        <ul className="divide-y divide-white/10 rounded-md border border-white/10">
          {versions.map((v) => {
            const isCurrent = v.versionNum === currentNum;
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
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
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
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-300">
                    view content
                  </summary>
                  <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded bg-black/30 p-3 font-mono text-xs text-white/80">
                    {v.content}
                  </pre>
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

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {revertConfirmTarget !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={dismissRevert}
          role="dialog"
          aria-modal="true"
          aria-labelledby="revert-confirm-heading"
          aria-describedby="revert-confirm-body"
        >
          <div
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
          </div>
        </div>
      )}
    </div>
  );
}
