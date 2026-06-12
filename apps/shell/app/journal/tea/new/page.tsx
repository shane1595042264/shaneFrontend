"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { uploadImage } from "@/lib/api/images";
import { createTeaEntry } from "@/lib/api/tea-entries";
import { MarkdownEditor } from "@shane/ui";

export default function NewTeaEntryPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  if (authLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8" aria-busy>
        <span className="sr-only">Loading…</span>
        <div className="h-3 w-28 rounded bg-white/8 animate-pulse" />
        <div className="mt-3 mb-4 h-7 w-44 rounded bg-white/8 animate-pulse" />
        <div className="h-64 w-full rounded border border-white/10 bg-white/8 animate-pulse" />
      </div>
    );
  }
  if (!user) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 text-sm text-gray-400">
        <Link href="/journal" className="text-gray-500 hover:text-gray-300">← back</Link>
        <p className="mt-4">Sign in to write a tea entry.</p>
      </div>
    );
  }

  const pinValid = /^\d{4}$/.test(pin);
  const canSubmit = !saving && !uploading && content.trim().length > 0 && pinValid;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const { entry } = await createTeaEntry({
        title: title.trim() || null,
        content,
        pin,
      });
      router.push(`/journal/tea/${entry.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? "Failed to publish");
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/journal" className="text-sm text-gray-500 hover:text-gray-300">
        ← back to journal
      </Link>
      <h1 className="mt-3 mb-1 flex items-center gap-2 font-mono text-2xl">
        <span aria-hidden>🍵</span> New tea entry
      </h1>
      <p className="mb-4 text-sm text-gray-400">
        Private. Anyone with the link needs the 4-digit PIN below to read it. You can see it any time from the entry page.
      </p>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs uppercase tracking-wider text-gray-500">Title (optional)</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="A short label only you see in your list"
          className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-white/30 focus:outline-none"
        />
      </label>

      <label className="mb-4 block">
        <span className="mb-1 block text-xs uppercase tracking-wider text-gray-500">4-digit PIN</span>
        <div className="flex items-center gap-2">
          <input
            type={showPin ? "text" : "password"}
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="••••"
            className="w-28 rounded-md border border-white/10 bg-black/40 px-3 py-2 text-center font-mono text-base tracking-[0.4em] text-white placeholder:text-gray-600 focus:border-white/30 focus:outline-none"
            aria-label="4-digit PIN"
            required
          />
          <button
            type="button"
            onClick={() => setShowPin((v) => !v)}
            className="text-xs text-gray-400 hover:text-gray-200"
            aria-pressed={showPin}
          >
            {showPin ? "Hide" : "Show"}
          </button>
        </div>
      </label>

      <MarkdownEditor
        value={content}
        onChange={setContent}
        onImageUpload={uploadImage}
        onUploadingChange={setUploading}
      />

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:gap-2">
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="inline-flex min-h-11 w-full items-center justify-center rounded bg-white px-4 text-sm font-medium text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {saving ? "Publishing…" : uploading ? "Waiting for upload…" : "Publish tea entry"}
        </button>
        <Link
          href="/journal"
          className="inline-flex min-h-11 w-full items-center justify-center rounded border border-white/20 px-4 text-sm hover:bg-white/5 sm:w-auto"
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}
