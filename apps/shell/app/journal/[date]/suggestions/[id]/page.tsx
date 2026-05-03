"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getEntry, listVersions } from "@/lib/api/journal";
import {
  approveSuggestion,
  getSuggestion,
  rejectSuggestion,
  withdrawSuggestion,
  type Suggestion,
} from "@/lib/api/suggestions";
import { SuggestionDiff } from "@/components/journal/suggestion-diff";

type DiffView = "current" | "base" | "full";

export default function SuggestionDetailPage() {
  const params = useParams<{ date: string; id: string }>();
  const date = params.date;
  const id = params.id;
  const router = useRouter();
  const { user } = useAuth();

  const [s, setS] = useState<Suggestion | null>(null);
  const [authorId, setAuthorId] = useState<string | null>(null);
  const [currentNum, setCurrentNum] = useState<number | null>(null);
  const [currentContent, setCurrentContent] = useState("");
  const [baseContent, setBaseContent] = useState("");
  const [view, setView] = useState<DiffView>("current");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([getSuggestion(id), getEntry(date), listVersions(date)])
      .then(async ([sug, entry, versions]) => {
        setS(sug);
        if (entry) {
          setAuthorId(entry.entry.authorId);
          setCurrentNum(entry.currentVersionNum);
          setCurrentContent(entry.content);
        }
        const base = versions.find((v) => v.id === sug.baseVersionId);
        if (base) setBaseContent(base.content);
      })
      .catch((e) => setError(e.message ?? "Failed to load suggestion"))
      .finally(() => setLoading(false));
  }, [id, date]);

  if (loading) {
    return <div className="mx-auto max-w-4xl px-4 py-12 text-sm text-gray-400">Loading…</div>;
  }
  if (!s) {
    return <div className="mx-auto max-w-4xl px-4 py-12 text-sm text-gray-400">Suggestion not found.</div>;
  }

  const isAuthor = !!user && authorId !== null && user.id === authorId;
  const isProposer = !!user && user.id === s.proposerId;
  const isPending = s.status === "pending";

  const refresh = async () => {
    const [sug, entry] = await Promise.all([getSuggestion(id), getEntry(date)]);
    setS(sug);
    if (entry) {
      setCurrentNum(entry.currentVersionNum);
      setCurrentContent(entry.content);
    }
  };

  const handleApprove = async () => {
    if (currentNum === null) return;
    setBusy(true);
    setError(null);
    try {
      await approveSuggestion(id, currentNum);
      router.push(`/journal/${date}`);
    } catch (e: any) {
      if (e.message === "VERSION_CONFLICT") {
        const cur = (e as any).currentVersionNum;
        setError(
          cur !== undefined
            ? `Entry was edited since this suggestion (now v${cur}). Refresh and retry.`
            : "Entry was edited since this suggestion. Refresh and retry."
        );
        await refresh();
      } else {
        setError(e.message ?? "Approve failed");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    const reason = prompt("Optional rejection reason:") ?? undefined;
    setBusy(true);
    setError(null);
    try {
      await rejectSuggestion(id, reason);
      router.push(`/journal/${date}/suggestions`);
    } catch (e: any) {
      setError(e.message ?? "Reject failed");
    } finally {
      setBusy(false);
    }
  };

  const handleWithdraw = async () => {
    if (!confirm("Withdraw this suggestion?")) return;
    setBusy(true);
    setError(null);
    try {
      await withdrawSuggestion(id);
      router.push(`/journal/${date}/suggestions`);
    } catch (e: any) {
      setError(e.message ?? "Withdraw failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href={`/journal/${date}/suggestions`} className="text-sm text-gray-500 hover:text-gray-300">
        ← all suggestions
      </Link>
      <h1 className="mt-3 mb-1 font-mono text-2xl">{date} — suggestion</h1>
      <p className="mb-4 text-sm text-gray-500">
        by <span className="font-mono">{s.proposerId.slice(0, 8)}</span>
        <span className="ml-2">{new Date(s.createdAt).toLocaleString()}</span>
        <span
          className={`ml-2 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
            s.status === "approved"
              ? "bg-emerald-500/15 text-emerald-300"
              : s.status === "rejected"
              ? "bg-red-500/15 text-red-300"
              : s.status === "withdrawn"
              ? "bg-gray-500/15 text-gray-300"
              : "bg-amber-500/15 text-amber-300"
          }`}
        >
          {s.status}
        </span>
        {s.status === "rejected" && s.rejectionReason && (
          <span className="ml-2 italic text-gray-400">— {s.rejectionReason}</span>
        )}
      </p>

      <div className="mb-4 flex gap-2 text-xs">
        {(["current", "base", "full"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded border px-2 py-1 ${
              view === v ? "border-white bg-white text-black" : "border-white/20 hover:bg-white/5"
            }`}
          >
            {v === "current" ? "vs current (live)" : v === "base" ? "vs base" : "full content"}
          </button>
        ))}
      </div>

      {view === "current" && <SuggestionDiff before={currentContent} after={s.proposedContent} />}
      {view === "base" && <SuggestionDiff before={baseContent} after={s.proposedContent} />}
      {view === "full" && (
        <pre className="overflow-x-auto rounded border border-white/10 bg-black/30 p-3 font-mono text-xs leading-5 text-gray-300 whitespace-pre-wrap">
          {s.proposedContent}
        </pre>
      )}

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {isPending && (
        <div className="mt-4 flex flex-wrap gap-2">
          {isAuthor && (
            <>
              <button
                onClick={handleApprove}
                disabled={busy || currentNum === null}
                className="rounded bg-emerald-700 px-3 py-1.5 text-sm text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                {busy ? "Working…" : "Approve"}
              </button>
              <button
                onClick={handleReject}
                disabled={busy}
                className="rounded bg-red-700 px-3 py-1.5 text-sm text-white hover:bg-red-600 disabled:opacity-50"
              >
                {busy ? "Working…" : "Reject"}
              </button>
            </>
          )}
          {isProposer && (
            <button
              onClick={handleWithdraw}
              disabled={busy}
              className="rounded border border-white/20 px-3 py-1.5 text-sm hover:bg-white/5 disabled:opacity-50"
            >
              {busy ? "Working…" : "Withdraw"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
