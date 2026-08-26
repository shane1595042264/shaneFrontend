"use client";

import { useEffect, useRef, useState } from "react";
import {
  createGame,
  searchIcons,
  type IconCandidate,
} from "@/lib/api/scoreboard";
import { COLOR_TOKENS, colorStyles } from "./palette";

// Safety net when the GitHub-backed search is down: a known-good
// game-icons slug the backend can always try to fetch directly.
const FALLBACK_ICON: IconCandidate = {
  slug: "delapouite/trophy-cup",
  previewUrl:
    "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/trophy-cup.svg",
};

const inputClass =
  "w-full rounded-md border border-white/20 bg-black/30 px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:border-white/40 focus:outline-none";

export function AddGameForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<IconCandidate[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [iconQuery, setIconQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // The icon search follows the name field unless an explicit icon query
  // was typed ("auto find" with a manual override).
  const effectiveQuery = iconQuery.trim() || name.trim();

  useEffect(() => {
    if (effectiveQuery.length < 2) {
      setCandidates([]);
      return;
    }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setSearching(true);
      const results = await searchIcons(effectiveQuery, controller.signal);
      if (!controller.signal.aborted) {
        setCandidates(results);
        setSelectedSlug((prev) =>
          prev && results.some((r) => r.slug === prev)
            ? prev
            : (results[0]?.slug ?? null),
        );
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [effectiveQuery]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const slug = selectedSlug ?? FALLBACK_ICON.slug;
    setSaving(true);
    setError(null);
    try {
      await createGame({
        name: name.trim(),
        description: description.trim() || null,
        rules: rules.trim() || null,
        iconSlug: slug,
        color: color ?? undefined,
      });
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the game");
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4"
    >
      <h2 className="text-lg font-medium">New game</h2>
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      <label className="block text-sm text-gray-300">
        Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={120}
          placeholder="Pool, Balloon Fight, Pillow Fight..."
          className={`mt-1 ${inputClass}`}
        />
      </label>

      <div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm text-gray-300">Game art</span>
          <input
            value={iconQuery}
            onChange={(e) => setIconQuery(e.target.value)}
            placeholder="Search different art..."
            aria-label="Search icons"
            className="w-48 rounded-md border border-white/20 bg-black/30 px-2 py-1 text-xs text-white placeholder-gray-500 focus:border-white/40 focus:outline-none"
          />
        </div>
        <div
          className="mt-2 grid grid-cols-6 gap-2 sm:grid-cols-12"
          role="listbox"
          aria-label="Icon candidates"
        >
          {(candidates.length > 0 ? candidates : [FALLBACK_ICON]).map((cand) => (
            <button
              key={cand.slug}
              type="button"
              role="option"
              aria-selected={
                selectedSlug === cand.slug ||
                (selectedSlug === null && cand.slug === FALLBACK_ICON.slug)
              }
              onClick={() => setSelectedSlug(cand.slug)}
              className={`rounded-md border p-1 ${
                selectedSlug === cand.slug ||
                (selectedSlug === null && cand.slug === FALLBACK_ICON.slug)
                  ? "border-white bg-white/10"
                  : "border-white/10 hover:border-white/30"
              }`}
              title={cand.slug}
            >
              {/* game-icons raw SVGs render white-on-black, matching the theme */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cand.previewUrl}
                alt={cand.slug}
                className="aspect-square w-full rounded-sm"
              />
            </button>
          ))}
        </div>
        {searching && (
          <p className="mt-1 text-xs text-gray-500">Searching art...</p>
        )}
      </div>

      <label className="block text-sm text-gray-300">
        Description
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={4000}
          placeholder="What is this game?"
          className={`mt-1 ${inputClass}`}
        />
      </label>

      <label className="block text-sm text-gray-300">
        House rules
        <textarea
          value={rules}
          onChange={(e) => setRules(e.target.value)}
          maxLength={4000}
          rows={3}
          placeholder="Best of 3. Loser buys boba."
          className={`mt-1 ${inputClass}`}
        />
      </label>

      <div>
        <span className="text-sm text-gray-300">Color</span>
        <div className="mt-1 flex flex-wrap gap-2">
          {COLOR_TOKENS.map((token) => (
            <button
              key={token}
              type="button"
              aria-label={`Color ${token}`}
              aria-pressed={color === token}
              onClick={() => setColor(token)}
              className={`h-7 w-7 rounded-full ${colorStyles(token).solid} ${
                color === token
                  ? "ring-2 ring-white ring-offset-2 ring-offset-black"
                  : ""
              }`}
            />
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={saving || name.trim().length === 0}
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-white px-4 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-50"
      >
        {saving ? "Adding..." : "Add game"}
      </button>
    </form>
  );
}
