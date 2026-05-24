"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { uploadTripFile } from "@/lib/api/trips";
import { LoginButton } from "@/components/login-button";

export default function NewTripPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [titleOverride, setTitleOverride] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acceptFile = useCallback((f: File) => {
    if (!/\.html?$/i.test(f.name) && f.type !== "text/html") {
      setError(`That file doesn't look like HTML (got "${f.type || "unknown type"}"). Pick a .html file.`);
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError(`That file is ${(f.size / 1024 / 1024).toFixed(1)} MB. Max is 10 MB.`);
      return;
    }
    setError(null);
    setFile(f);
  }, []);

  const submit = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const res = await uploadTripFile(file, titleOverride.trim() || undefined);
      router.push(`/trips/${res.slug}`);
    } catch (err: any) {
      setError(err?.message ?? "Upload failed");
      setUploading(false);
    }
  };

  if (authLoading) {
    return <div className="mx-auto max-w-3xl px-4 py-12 text-sm text-gray-400">Loading…</div>;
  }
  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Link href="/trips" className="text-sm text-gray-500 hover:text-gray-300">← back</Link>
        <p className="mt-6 mb-3 text-sm text-gray-400">Sign in to upload a trip.</p>
        <LoginButton />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/trips" className="text-sm text-gray-500 hover:text-gray-300">← back to trips</Link>
      <h1 className="mt-3 mb-6 text-2xl font-semibold">Upload a trip</h1>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) acceptFile(f);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed p-6 text-center transition-colors ${
          dragging
            ? "border-blue-400 bg-blue-500/10"
            : "border-white/15 bg-black/20 hover:border-white/30 hover:bg-black/30"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".html,.htm,text/html"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) acceptFile(f);
          }}
          className="hidden"
        />
        {file ? (
          <>
            <p className="text-sm text-white">{file.name}</p>
            <p className="mt-1 text-xs text-gray-500">
              {(file.size / 1024).toFixed(1)} KB · click to pick a different file
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-300">Drop an HTML file here, or click to pick one.</p>
            <p className="mt-1 text-xs text-gray-500">Max 10 MB. Title is extracted from the file automatically.</p>
          </>
        )}
      </div>

      <div className="mt-6">
        <label htmlFor="title-override" className="mb-1 block text-sm text-gray-400">
          Title <span className="text-gray-600">(optional — overrides what we extract)</span>
        </label>
        <input
          id="title-override"
          type="text"
          value={titleOverride}
          onChange={(e) => setTitleOverride(e.target.value)}
          placeholder="e.g. Tokyo + Kyoto, May 2026"
          maxLength={200}
          className="block min-h-11 w-full rounded border border-white/15 bg-black/30 px-3 py-1.5 text-sm text-white/90 focus:border-white/40 focus:outline-none"
        />
      </div>

      {error && <p role="alert" className="mt-4 text-sm text-red-400">{error}</p>}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={submit}
          disabled={!file || uploading}
          className="inline-flex min-h-11 items-center justify-center rounded bg-white px-4 text-sm font-medium text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Upload"}
        </button>
        <Link
          href="/trips"
          className="inline-flex min-h-11 items-center justify-center rounded border border-white/20 px-4 text-sm hover:bg-white/5"
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}
