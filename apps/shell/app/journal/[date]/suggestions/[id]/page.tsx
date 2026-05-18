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
import { RelativeTime } from "@/lib/format-time";

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
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!rejectOpen && !withdrawOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) {
        if (rejectOpen) {
          setRejectOpen(false);
          setRejectError(null);
        }
        if (withdrawOpen) {
          setWithdrawOpen(false);
          setWithdrawError(null);
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [rejectOpen, withdrawOpen, busy]);

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
      await approveSuggestion(id, currentNum, date);
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

  const openReject = () => {
    setRejectReason("");
    setRejectError(null);
    setRejectOpen(true);
  };

  const dismissReject = () => {
    if (busy) return;
    setRejectOpen(false);
    setRejectError(null);
  };

  const confirmReject = async () => {
    setBusy(true);
    setRejectError(null);
    try {
      const reason = rejectReason.trim() || undefined;
      await rejectSuggestion(id, reason, date);
      router.push(`/journal/${date}/suggestions`);
    } catch (e: any) {
      setRejectError(e.message ?? "Reject failed");
    } finally {
      setBusy(false);
    }
  };

  const openWithdraw = () => {
    setWithdrawError(null);
    setWithdrawOpen(true);
  };

  const dismissWithdraw = () => {
    if (busy) return;
    setWithdrawOpen(false);
    setWithdrawError(null);
  };

  const confirmWithdraw = async () => {
    setBusy(true);
    setWithdrawError(null);
    try {
      await withdrawSuggestion(id, date);
      router.push(`/journal/${date}/suggestions`);
    } catch (e: any) {
      setWithdrawError(e.message ?? "Withdraw failed");
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
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-500">
        {s.proposer?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={s.proposer.avatarUrl}
            alt=""
            className="h-5 w-5 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : null}
        <span className="text-gray-300">{s.proposer?.name?.trim() || "Anonymous"}</span>
        <RelativeTime iso={s.createdAt} />
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
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
          <span className="italic text-gray-400">— {s.rejectionReason}</span>
        )}
      </div>

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
                onClick={openReject}
                disabled={busy}
                className="rounded bg-red-700 px-3 py-1.5 text-sm text-white hover:bg-red-600 disabled:opacity-50"
              >
                {busy ? "Working…" : "Reject"}
              </button>
            </>
          )}
          {isProposer && (
            <button
              onClick={openWithdraw}
              disabled={busy}
              className="rounded border border-white/20 px-3 py-1.5 text-sm hover:bg-white/5 disabled:opacity-50"
            >
              {busy ? "Working…" : "Withdraw"}
            </button>
          )}
        </div>
      )}

      {rejectOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={dismissReject}
          role="dialog"
          aria-modal="true"
          aria-labelledby="suggestion-reject-heading"
        >
          <div
            className="bg-gray-900 border border-white/10 rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="suggestion-reject-heading" className="text-lg font-semibold text-white mb-2">
              Reject this suggestion?
            </h3>
            <p className="text-sm text-gray-400 mb-3">
              Optional: tell the proposer why. They will see this on the suggestion.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason (optional)"
              disabled={busy}
              className="h-24 w-full resize-y rounded border border-white/10 bg-black/40 p-2 text-sm text-white/90 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 disabled:opacity-50"
            />
            {rejectError && (
              <p role="alert" className="mt-3 text-sm text-red-400">{rejectError}</p>
            )}
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={dismissReject}
                disabled={busy}
                className="px-4 py-2 text-sm bg-white/5 hover:bg-white/10 disabled:opacity-50 text-gray-400 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmReject}
                disabled={busy}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded transition-colors"
              >
                {busy ? "Rejecting…" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {withdrawOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={dismissWithdraw}
          role="dialog"
          aria-modal="true"
          aria-labelledby="suggestion-withdraw-heading"
        >
          <div
            className="bg-gray-900 border border-white/10 rounded-lg p-6 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="suggestion-withdraw-heading" className="text-lg font-semibold text-white mb-2">
              Withdraw this suggestion?
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              The author will no longer see it. You can always propose another one.
            </p>
            {withdrawError && (
              <p role="alert" className="mb-4 text-sm text-red-400">{withdrawError}</p>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={dismissWithdraw}
                disabled={busy}
                className="px-4 py-2 text-sm bg-white/5 hover:bg-white/10 disabled:opacity-50 text-gray-400 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmWithdraw}
                disabled={busy}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded transition-colors"
              >
                {busy ? "Withdrawing…" : "Withdraw"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
