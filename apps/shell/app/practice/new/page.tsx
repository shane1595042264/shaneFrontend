"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  previewSession,
  createSessionFromGenerator,
  listPracticeableItems,
  type PracticeableItem,
} from "@/lib/api/practice";
import { LoginButton } from "@/components/login-button";

export default function NewSessionPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [n, setN] = useState(5);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [includeSolidified, setIncludeSolidified] = useState(false);
  const [preview, setPreview] = useState<PracticeableItem[] | null>(null);
  // Distinct categories from the user's full corpus, alphabetical. null = loading,
  // [] = loaded-but-empty OR fetch failed (degrade to "Any category" only).
  const [categories, setCategories] = useState<string[] | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    previewSession(categoryFilter || null, n, includeSolidified)
      .then((items) => { if (!cancelled) setPreview(items); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [user, n, categoryFilter, includeSolidified]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    // Derive options from the full corpus (includeSolidified=true) so the dropdown
    // stays stable across the "Include solidified" toggle.
    listPracticeableItems(null, true)
      .then((items) => {
        if (cancelled) return;
        setCategories(Array.from(new Set(items.map((i) => i.category))).sort());
      })
      .catch(() => { if (!cancelled) setCategories([]); });
    return () => { cancelled = true; };
  }, [user]);

  if (authLoading) return <div className="mx-auto max-w-3xl px-4 py-12 text-sm text-gray-400">Loading…</div>;
  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Link href="/practice" className="text-sm text-gray-500 hover:text-gray-300">← back</Link>
        <p className="mt-6 mb-3 text-sm">Sign in to create a session.</p>
        <LoginButton />
      </div>
    );
  }

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      const { session } = await createSessionFromGenerator({
        nItemsRequested: n,
        categoryFilter: categoryFilter || undefined,
        includeSolidified,
      });
      router.push(`/practice/sessions/${session.id}`);
    } catch (e) {
      setError((e as Error).message ?? "Failed");
      setStarting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/practice" className="text-sm text-gray-500 hover:text-gray-300">← back</Link>
      <h1 className="mt-3 mb-6 text-2xl font-semibold">New session</h1>

      <div className="space-y-4">
        <label className="block">
          <span className="block text-sm text-gray-400">Number of items</span>
          <input
            type="number"
            min={1}
            max={50}
            value={n}
            onChange={(e) => setN(Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)))}
            className="mt-1 block w-24 rounded border border-white/15 bg-black/30 px-3 py-1.5 text-sm focus:border-white/40 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="block text-sm text-gray-400">Category filter (optional)</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            disabled={categories === null}
            className="mt-1 block w-full max-w-xs rounded border border-white/15 bg-black/30 px-3 py-1.5 text-sm focus:border-white/40 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Any category</option>
            {(categories ?? []).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input type="checkbox" checked={includeSolidified} onChange={(e) => setIncludeSolidified(e.target.checked)} />
          Include solidified items
        </label>
      </div>

      {error && <p role="alert" className="mt-8 mb-4 text-sm text-red-400">{error}</p>}

      <section className={error ? "" : "mt-8"}>
        <h2 className="mb-2 text-sm font-medium text-gray-400">
          Preview ({preview !== null ? preview.length : error ? "—" : "…"} items)
        </h2>
        {preview === null ? (
          error ? null : <p className="text-xs text-gray-500">Loading…</p>
        ) : preview.length === 0 ? (
          <p className="text-xs text-gray-500">No items match. Try a different filter or configure more items in /knowledge.</p>
        ) : (
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {preview.map((it) => (
              <li key={it.itemId}>
                {it.word}
                <span className="ml-2 text-xs text-gray-500">
                  ({it.prescription.setMode === "time" ? `${it.prescription.setSize}s` : `${it.prescription.setSize} reps`})
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={start}
          disabled={starting || (preview?.length ?? 0) === 0}
          className="inline-flex min-h-11 items-center justify-center rounded bg-white px-4 text-sm font-medium text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {starting ? "Starting…" : "Start session"}
        </button>
        <Link
          href="/practice"
          className="inline-flex min-h-11 items-center justify-center rounded border border-white/20 px-4 text-sm hover:bg-white/5"
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}
