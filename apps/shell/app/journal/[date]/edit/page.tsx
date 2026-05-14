"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getEntry, createEntry, type EntryDetail } from "@/lib/api/journal";
import { MarkdownEditor } from "@/components/journal/markdown-editor";

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

  if (authLoading || loading) {
    return <div className="mx-auto max-w-5xl px-4 py-12 text-sm text-gray-400">Loading…</div>;
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
          onClick={() => {
            if (dirty && !window.confirm("Discard unsaved changes?")) return;
            skipPromptRef.current = true;
            router.push(`/journal/${date}`);
          }}
          disabled={saving}
          className="inline-flex min-h-11 w-full items-center justify-center rounded border border-white/20 px-4 text-sm hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
