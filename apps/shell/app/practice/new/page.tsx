"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/auth-gate";
import {
  previewSession,
  createSessionFromGenerator,
  listPracticeableItems,
  listLocations,
  vocabPreview,
  createVocabSession,
  type PracticeableItem,
  type Location,
} from "@/lib/api/practice";

type Mode = "workout" | "vocab";

function NewSessionContent() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("workout");

  // Shared error surface.
  const [error, setError] = useState<string | null>(null);

  // ---- Workout mode (existing) ----
  const [n, setN] = useState(5);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [includeSolidified, setIncludeSolidified] = useState(false);
  const [preview, setPreview] = useState<PracticeableItem[] | null>(null);
  const [categories, setCategories] = useState<string[] | null>(null);
  const [starting, setStarting] = useState(false);

  // ---- Vocab mode ----
  const [vocabN, setVocabN] = useState(10);
  const [location, setLocation] = useState("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [counts, setCounts] = useState<{ dueAvailable: number; newAvailable: number } | null>(null);
  const [startingVocab, setStartingVocab] = useState(false);

  useEffect(() => {
    if (mode !== "workout") return;
    let cancelled = false;
    previewSession(categoryFilter || null, n, includeSolidified)
      .then((items) => { if (!cancelled) setPreview(items); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [mode, n, categoryFilter, includeSolidified]);

  useEffect(() => {
    if (mode !== "workout") return;
    let cancelled = false;
    listPracticeableItems(null, true)
      .then((items) => {
        if (cancelled) return;
        setCategories(Array.from(new Set(items.map((i) => i.category))).sort());
      })
      .catch(() => { if (!cancelled) setCategories([]); });
    return () => { cancelled = true; };
  }, [mode]);

  useEffect(() => {
    listLocations().then(setLocations).catch(() => {});
  }, []);

  // Debounced vocab preview when a location is chosen.
  useEffect(() => {
    if (mode !== "vocab" || !location.trim()) { setCounts(null); return; }
    let cancelled = false;
    const t = setTimeout(() => {
      vocabPreview(location.trim(), vocabN)
        .then((c) => { if (!cancelled) setCounts(c); })
        .catch(() => { if (!cancelled) setCounts(null); });
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [mode, location, vocabN]);

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

  const startVocab = async () => {
    setStartingVocab(true);
    setError(null);
    try {
      const { session } = await createVocabSession(location.trim(), vocabN);
      router.push(`/practice/sessions/${session.id}`);
    } catch (e) {
      setError((e as Error).message ?? "Failed");
      setStartingVocab(false);
    }
  };

  const vocabTotal = counts ? counts.dueAvailable + counts.newAvailable : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/practice" className="text-sm text-gray-500 hover:text-gray-300">← back</Link>
      <h1 className="mt-3 mb-6 text-2xl font-semibold">New session</h1>

      {/* Mode toggle */}
      <div className="mb-8 inline-flex rounded-lg border border-white/15 p-1 text-sm">
        <button
          type="button"
          onClick={() => { setMode("workout"); setError(null); }}
          className={`rounded-md px-4 py-1.5 ${mode === "workout" ? "bg-white text-black" : "text-gray-400 hover:text-white"}`}
        >
          Workout (timed)
        </button>
        <button
          type="button"
          onClick={() => { setMode("vocab"); setError(null); }}
          className={`rounded-md px-4 py-1.5 ${mode === "vocab" ? "bg-white text-black" : "text-gray-400 hover:text-white"}`}
        >
          Vocabulary (flashcards)
        </button>
      </div>

      {mode === "workout" ? (
        <>
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
        </>
      ) : (
        <>
          <p className="mb-4 text-sm text-gray-400">
            Draws random Knowledge cards labeled <span className="text-gray-200">Vocabulary</span>. Familiarity levels up per location —
            reach level 3 at a place and the word is memorized there.
          </p>

          <div className="space-y-4">
            <div>
              <span className="block text-sm text-gray-400">Where are you practicing right now?</span>
              {locations.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {locations.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setLocation(l.name)}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        location.trim().toLowerCase() === l.name.toLowerCase()
                          ? "border-white bg-white/10"
                          : "border-white/15 hover:bg-white/10"
                      }`}
                    >
                      {l.name}
                    </button>
                  ))}
                </div>
              )}
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Type a location (e.g. Home, Café, Office)…"
                className="mt-2 block w-full max-w-sm rounded border border-white/15 bg-black/30 px-3 py-1.5 text-sm focus:border-white/40 focus:outline-none"
              />
            </div>

            <label className="block">
              <span className="block text-sm text-gray-400">Number of words</span>
              <input
                type="number"
                min={1}
                max={50}
                value={vocabN}
                onChange={(e) => setVocabN(Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)))}
                className="mt-1 block w-24 rounded border border-white/15 bg-black/30 px-3 py-1.5 text-sm focus:border-white/40 focus:outline-none"
              />
            </label>
          </div>

          {error && <p role="alert" className="mt-8 mb-4 text-sm text-red-400">{error}</p>}

          <section className={error ? "" : "mt-8"}>
            {!location.trim() ? (
              <p className="text-xs text-gray-500">Pick a location to see how many words are ready.</p>
            ) : counts === null ? (
              <p className="text-xs text-gray-500">Checking…</p>
            ) : (
              <p className="text-sm text-gray-400">
                <span className="text-gray-200">{counts.dueAvailable}</span> due ·{" "}
                <span className="text-gray-200">{counts.newAvailable}</span> new available at{" "}
                <span className="text-gray-200">{location.trim()}</span>
              </p>
            )}
          </section>

          <div className="mt-8 flex gap-3">
            <button
              type="button"
              onClick={startVocab}
              disabled={startingVocab || !location.trim() || vocabTotal === 0}
              className="inline-flex min-h-11 items-center justify-center rounded bg-white px-4 text-sm font-medium text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {startingVocab ? "Starting…" : "Start session"}
            </button>
            <Link
              href="/practice"
              className="inline-flex min-h-11 items-center justify-center rounded border border-white/20 px-4 text-sm hover:bg-white/5"
            >
              Cancel
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

export default function NewSessionPage() {
  return (
    <AuthGate>
      <NewSessionContent />
    </AuthGate>
  );
}
