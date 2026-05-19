// apps/shell/app/journal/[date]/suggest/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getEntry } from "@/lib/api/journal";
import { createSuggestion } from "@/lib/api/suggestions";
import { MarkdownEditor } from "@/components/journal/markdown-editor";
import { LoginButton } from "@/components/login-button";

export default function SuggestPage() {
  const params = useParams<{ date: string }>();
  const date = params.date;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [content, setContent] = useState("");
  const [initialContent, setInitialContent] = useState("");
  const [baseVersionNum, setBaseVersionNum] = useState<number | null>(null);
  const [authorId, setAuthorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const skipPromptRef = useRef(false);
  const dirty = content !== initialContent;

  useEffect(() => {
    getEntry(date)
      .then((r) => {
        if (r) {
          setContent(r.content);
          setInitialContent(r.content);
          setBaseVersionNum(r.currentVersionNum);
          setAuthorId(r.entry.authorId);
        }
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
          <p>Sign in with Google to suggest an edit.</p>
          <LoginButton />
        </div>
      </div>
    );
  }
  if (baseVersionNum === null || authorId === null) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 text-sm text-gray-400">
        <Link href={`/journal/${date}`} className="text-gray-500 hover:text-gray-300">← back</Link>
        <p className="mt-4">Entry not found.</p>
      </div>
    );
  }
  if (authorId === user.id) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 text-sm text-gray-400">
        <Link href={`/journal/${date}`} className="text-gray-500 hover:text-gray-300">← back</Link>
        <p className="mt-4">You&apos;re the author of this entry — add a timestamped append instead.</p>
        <Link
          href={`/journal/${date}/append`}
          className="mt-3 inline-flex min-h-11 items-center justify-center rounded bg-white px-4 text-sm font-medium text-black hover:bg-gray-200"
        >
          Append
        </Link>
      </div>
    );
  }

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const created = await createSuggestion(date, baseVersionNum, content);
      skipPromptRef.current = true;
      router.push(`/journal/${date}/suggestions?submitted=${created.id}`);
    } catch (err: any) {
      setError(err.message ?? "Failed to submit suggestion");
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href={`/journal/${date}`} className="text-sm text-gray-500 hover:text-gray-300">
        ← back to entry
      </Link>
      <h1 className="mt-3 mb-1 font-mono text-2xl">
        {date} — suggest <span className="text-sm font-normal text-gray-500">(based on v{baseVersionNum})</span>
      </h1>
      <p className="mb-4 text-sm text-gray-400">
        The author will review and approve or reject. If the author edits the entry before deciding, your base will be out of date and the diff vs current may shift.
      </p>
      <MarkdownEditor value={content} onChange={setContent} />
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:gap-2">
        <button
          onClick={submit}
          disabled={saving || !content.trim() || content === ""}
          className="inline-flex min-h-11 w-full items-center justify-center rounded bg-white px-4 text-sm font-medium text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {saving ? "Submitting…" : "Submit suggestion"}
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
          <div
            className="bg-gray-900 border border-white/10 rounded-lg p-6 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="discard-confirm-heading" className="text-lg font-semibold text-white mb-2">
              Discard this suggestion?
            </h3>
            <p id="discard-confirm-body" className="text-sm text-gray-400 mb-4">
              The edits you&apos;ve drafted will be lost. This can&apos;t be undone.
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
          </div>
        </div>
      )}
    </div>
  );
}
