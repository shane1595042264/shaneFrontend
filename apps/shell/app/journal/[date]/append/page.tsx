"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getEntry, createAppend } from "@/lib/api/journal";
import { MarkdownEditor } from "@/components/journal/markdown-editor";
import { LoginButton } from "@/components/login-button";

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
          className="mt-3 inline-block rounded bg-white px-3 py-1.5 text-sm text-black hover:bg-gray-200"
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
          className="mt-3 inline-block rounded border border-white/20 px-3 py-1.5 text-sm hover:bg-white/5"
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
      router.push(`/journal/${date}`);
      router.refresh();
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
      <div className="mt-4 flex gap-2">
        <button
          onClick={submit}
          disabled={saving || !content.trim()}
          className="rounded bg-white px-3 py-1.5 text-sm text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Appending…" : "Append"}
        </button>
        <button
          onClick={() => {
            if (dirty && !window.confirm("Discard this append?")) return;
            skipPromptRef.current = true;
            router.push(`/journal/${date}`);
          }}
          disabled={saving}
          className="rounded border border-white/20 px-3 py-1.5 text-sm hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
