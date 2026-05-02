// apps/shell/app/journal/[date]/history/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { listVersions, getEntry, revertEntry, type JournalVersion } from "@/lib/api/journal";

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

  const handleRevert = async (target: number) => {
    if (currentNum === null) return;
    if (!confirm(`Revert to v${target}? A new version will be created with v${target}'s content.`)) return;
    setReverting(target);
    setError(null);
    try {
      await revertEntry(date, target, currentNum);
      // refresh in place
      const [vs, entry] = await Promise.all([listVersions(date), getEntry(date)]);
      setVersions(vs);
      if (entry) setCurrentNum(entry.currentVersionNum);
    } catch (e: any) {
      if (e.message === "VERSION_CONFLICT") {
        const cur = (e as any).currentVersionNum;
        setError(
          cur !== undefined
            ? `Someone else edited the entry (now v${cur}). Refresh and try again.`
            : "Someone else edited the entry. Refresh and try again."
        );
      } else {
        setError(e.message ?? "Revert failed");
      }
    } finally {
      setReverting(null);
    }
  };

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
                  <span className="text-xs text-gray-500">
                    by {v.editorId.slice(0, 8)} · {new Date(v.createdAt).toLocaleString()}
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
                    onClick={() => handleRevert(v.versionNum)}
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
    </div>
  );
}
