// apps/shell/app/journal/[date]/suggest/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getEntry } from "@/lib/api/journal";
import { createSuggestion } from "@/lib/api/suggestions";
import { MarkdownEditor } from "@/components/journal/markdown-editor";

export default function SuggestPage() {
  const params = useParams<{ date: string }>();
  const date = params.date;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [content, setContent] = useState("");
  const [baseVersionNum, setBaseVersionNum] = useState<number | null>(null);
  const [authorId, setAuthorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEntry(date)
      .then((r) => {
        if (r) {
          setContent(r.content);
          setBaseVersionNum(r.currentVersionNum);
          setAuthorId(r.entry.authorId);
        }
      })
      .finally(() => setLoading(false));
  }, [date]);

  if (authLoading || loading) {
    return <div className="mx-auto max-w-5xl px-4 py-12 text-sm text-gray-400">Loading…</div>;
  }
  if (!user) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 text-sm text-gray-400">
        <Link href={`/journal/${date}`} className="text-gray-500 hover:text-gray-300">← back</Link>
        <p className="mt-4">Sign in to suggest edits.</p>
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
        <p className="mt-4">You're the author of this entry — edit it directly instead.</p>
        <Link
          href={`/journal/${date}/edit`}
          className="mt-3 inline-block rounded bg-white px-3 py-1.5 text-sm text-black hover:bg-gray-200"
        >
          Edit
        </Link>
      </div>
    );
  }

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await createSuggestion(date, baseVersionNum, content);
      router.push(`/journal/${date}/suggestions`);
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
      <div className="mt-4 flex gap-2">
        <button
          onClick={submit}
          disabled={saving || !content.trim() || content === ""}
          className="rounded bg-white px-3 py-1.5 text-sm text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Submitting…" : "Submit suggestion"}
        </button>
        <button
          onClick={() => router.push(`/journal/${date}`)}
          className="rounded border border-white/20 px-3 py-1.5 text-sm hover:bg-white/5"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
