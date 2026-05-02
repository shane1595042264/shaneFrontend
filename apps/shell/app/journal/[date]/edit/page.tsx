"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getEntry, createEntry, editEntry, type EntryDetail } from "@/lib/api/journal";
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
  const [versionNum, setVersionNum] = useState<number | null>(null);
  const [authorId, setAuthorId] = useState<string | null>(null);
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
        if (r) {
          setContent(r.content);
          setInitialContent(r.content);
          setVersionNum(r.currentVersionNum);
          setAuthorId(r.entry.authorId);
        }
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

  // Author check (only for existing entries — new entries have no author yet)
  if (!isNew && authorId !== null && authorId !== user.id) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 text-sm text-gray-400">
        <Link href={`/journal/${date}`} className="text-gray-500 hover:text-gray-300">← back</Link>
        <p className="mt-4">Only the entry author can edit directly. Try suggesting an edit instead.</p>
        <Link
          href={`/journal/${date}/suggest`}
          className="mt-3 inline-block rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-500"
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
      if (isNew) {
        await createEntry(date, content);
      } else if (versionNum !== null) {
        await editEntry(date, content, versionNum);
      } else {
        throw new Error("No version number — cannot edit");
      }
      skipPromptRef.current = true;
      router.push(`/journal/${date}`);
    } catch (err: any) {
      if (err.message === "ENTRY_EXISTS") {
        setError("Someone created an entry for this date before you. Try suggesting an edit instead.");
      } else if (err.message === "VERSION_CONFLICT") {
        const cur = (err as any).currentVersionNum;
        setError(
          cur !== undefined
            ? `Someone else edited this entry (now v${cur}). Refresh and try again.`
            : "Someone else edited this entry. Refresh and try again."
        );
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
      <h1 className="mt-3 mb-4 font-mono text-2xl">
        {date} — {isNew ? "create" : "edit"}
        {!isNew && versionNum !== null && (
          <span className="ml-2 text-sm font-normal text-gray-500">(based on v{versionNum})</span>
        )}
      </h1>
      <MarkdownEditor value={content} onChange={setContent} />
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button
          onClick={submit}
          disabled={saving || !content.trim()}
          className="rounded bg-white px-3 py-1.5 text-sm text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving…" : isNew ? "Publish" : "Save new version"}
        </button>
        <button
          onClick={() => {
            if (dirty && !window.confirm("Discard unsaved changes?")) return;
            skipPromptRef.current = true;
            router.push(`/journal/${date}`);
          }}
          className="rounded border border-white/20 px-3 py-1.5 text-sm hover:bg-white/5"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
