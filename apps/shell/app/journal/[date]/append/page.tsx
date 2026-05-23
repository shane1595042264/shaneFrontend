"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getEntry, createAppend } from "@/lib/api/journal";
import { MarkdownEditor } from "@shane/ui";
import { LoginButton } from "@/components/login-button";
import { FocusTrappedDiv } from "@/components/focus-trapped-div";

export default function AppendEntryPage() {
  const params = useParams<{ date: string }>();
  const date = params.date;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [content, setContent] = useState("");
  const [authorId, setAuthorId] = useState<string | null>(null);
  const [entryMissing, setEntryMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const skipPromptRef = useRef(false);
  const dirty = content.length > 0;

  useEffect(() => {
    getEntry(date)
      .then((r) => {
        if (!r) setEntryMissing(true);
        else setAuthorId(r.entry.authorId);
      })
      .finally(() => setLoading(false));
  }, [date]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (skipPromptRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  useEffect(() => {
    if (!discardConfirmOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDiscardConfirmOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [discardConfirmOpen]);

  const requestCancel = () => {
    if (!dirty) {
      skipPromptRef.current = true;
      router.push(`/journal/${date}`);
      return;
    }
    setDiscardConfirmOpen(true);
  };

  const confirmDiscard = () => {
    skipPromptRef.current = true;
    router.push(`/journal/${date}`);
  };

  if (authLoading || loading) {
    return <div className="mx-auto max-w-5xl px-4 py-12 text-sm text-gray-400">Loading…</div>;
  }
  if (!user) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 text-sm text-gray-400">
        <Link href={`/journal/${date}`} className="text-gray-500 hover:text-gray-300">← back</Link>
        <div className="mt-6 flex flex-col items-start gap-3">
          <p>Sign in with Google to append to this entry.</p>
          <LoginButton />
        </div>
      </div>
    );
  }
  if (entryMissing) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 text-sm text-gray-400">
        <Link href={`/journal/${date}`} className="text-gray-500 hover:text-gray-300">← back</Link>
        <p className="mt-4">No entry exists for this date yet.</p>
        <Link
          href={`/journal/${date}/edit?new=1`}
          className="mt-3 inline-flex min-h-11 items-center justify-center rounded bg-white px-4 text-sm font-medium text-black hover:bg-gray-200"
        >
          Start the entry
        </Link>
      </div>
    );
  }
  if (authorId !== null && authorId !== user.id) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 text-sm text-gray-400">
        <Link href={`/journal/${date}`} className="text-gray-500 hover:text-gray-300">← back</Link>
        <p className="mt-4">Only the entry author can append. You can suggest an edit instead.</p>
        <Link
          href={`/journal/${date}/suggest`}
          className="mt-3 inline-flex min-h-11 items-center justify-center rounded border border-white/20 px-4 text-sm hover:bg-white/5"
        >
          Suggest edit
        </Link>
      </div>
    );
  }

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await createAppend(date, content);
      skipPromptRef.current = true;
      // Hard nav: Next 15's client router cache (staleTimes.static=5min) can serve
      // the prior /journal/[date] RSC payload because the user just came from there.
      // router.refresh refreshes the current page, not the push destination.
      window.location.href = `/journal/${date}`;
    } catch (err: any) {
      if (err.message === "NOT_AUTHOR") setError("Only the author can append.");
      else if (err.message === "ENTRY_NOT_FOUND") setError("Entry no longer exists.");
      else setError(err.message ?? "Failed to append");
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href={`/journal/${date}`} className="text-sm text-gray-500 hover:text-gray-300">
        ← back to entry
      </Link>
      <h1 className="mt-3 mb-1 font-mono text-2xl">{date} — append</h1>
      <p className="mb-4 text-sm text-gray-400">
        Entries are append-only. Each append is timestamped and added below the existing content.
      </p>
      <MarkdownEditor value={content} onChange={setContent} />
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:gap-2">
        <button
          onClick={submit}
          disabled={saving || !content.trim()}
          className="inline-flex min-h-11 w-full items-center justify-center rounded bg-white px-4 text-sm font-medium text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {saving ? "Appending…" : "Append"}
        </button>
        <button
          onClick={requestCancel}
          disabled={saving}
          className="inline-flex min-h-11 w-full items-center justify-center rounded border border-white/20 px-4 text-sm hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          Cancel
        </button>
      </div>

      {discardConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setDiscardConfirmOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="discard-confirm-heading"
          aria-describedby="discard-confirm-body"
        >
          <FocusTrappedDiv
            className="bg-gray-900 border border-white/10 rounded-lg p-6 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="discard-confirm-heading" className="text-lg font-semibold text-white mb-2">
              Discard this append?
            </h3>
            <p id="discard-confirm-body" className="text-sm text-gray-400 mb-4">
              The text you&apos;ve written will be lost. This can&apos;t be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDiscardConfirmOpen(false)}
                className="px-4 py-2 text-sm bg-white/5 hover:bg-white/10 text-gray-400 rounded transition-colors"
              >
                Keep writing
              </button>
              <button
                type="button"
                onClick={confirmDiscard}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
              >
                Discard
              </button>
            </div>
          </FocusTrappedDiv>
        </div>
      )}
    </div>
  );
}
