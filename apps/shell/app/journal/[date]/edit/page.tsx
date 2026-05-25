"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getEntry, createEntry, type EntryDetail } from "@/lib/api/journal";
import { MarkdownEditor } from "@shane/ui";
import { FocusTrappedDiv } from "@/components/focus-trapped-div";

export default function EditEntryPage() {
  const params = useParams<{ date: string }>();
  const date = params.date;
  const router = useRouter();
  const search = useSearchParams();
  const isNew = search.get("new") === "1";
  const { user, loading: authLoading } = useAuth();
  const [content, setContent] = useState("");
  const [initialContent, setInitialContent] = useState("");
  const [entryExists, setEntryExists] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  // Set right before router.push on a successful save so the beforeunload
  // listener doesn't fire during the in-app navigation that follows.
  const skipPromptRef = useRef(false);
  const dirty = content !== initialContent;

  useEffect(() => {
    if (isNew) return;
    getEntry(date)
      .then((r: EntryDetail | null) => {
        if (r) setEntryExists(true);
      })
      .finally(() => setLoading(false));
  }, [date, isNew]);

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
    return (
      <div className="mx-auto max-w-5xl px-4 py-8" aria-busy={true}>
        <div role="status" aria-label="Loading entry editor">
          <span className="sr-only">Loading entry editor…</span>
          <div className="h-3 w-28 rounded bg-white/8 animate-pulse" />
          <div className="mt-3 mb-4 h-7 w-44 rounded bg-white/8 animate-pulse" />
          <div className="h-64 w-full rounded border border-white/10 bg-white/8 animate-pulse" />
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:gap-2">
            <div className="h-11 w-full rounded bg-white/8 animate-pulse sm:w-24" />
            <div className="h-11 w-full rounded border border-white/10 bg-white/8 animate-pulse sm:w-24" />
          </div>
        </div>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 text-sm text-gray-400">
        <Link href={`/journal/${date}`} className="text-gray-500 hover:text-gray-300">← back</Link>
        <p className="mt-4">Sign in to edit.</p>
      </div>
    );
  }

  // Direct edits of existing entries are disabled — entries are append-only.
  if (!isNew && entryExists) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 text-sm text-gray-400">
        <Link href={`/journal/${date}`} className="text-gray-500 hover:text-gray-300">← back</Link>
        <p className="mt-4">Entries are append-only. You can&apos;t edit existing content — add a new timestamped append instead.</p>
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
      await createEntry(date, content);
      skipPromptRef.current = true;
      router.push(`/journal/${date}`);
      router.refresh();
    } catch (err: any) {
      if (err.message === "ENTRY_EXISTS") {
        setError("Someone created an entry for this date before you. Try suggesting an edit instead.");
      } else {
        setError(err.message ?? "Failed to save");
      }
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href={`/journal/${date}`} className="text-sm text-gray-500 hover:text-gray-300">
        ← back to entry
      </Link>
      <h1 className="mt-3 mb-4 font-mono text-2xl">{date} — create</h1>
      <MarkdownEditor value={content} onChange={setContent} />
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:gap-2">
        <button
          onClick={submit}
          disabled={saving || !content.trim()}
          className="inline-flex min-h-11 w-full items-center justify-center rounded bg-white px-4 text-sm font-medium text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {saving ? "Saving…" : "Publish"}
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
              Discard unsaved changes?
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
