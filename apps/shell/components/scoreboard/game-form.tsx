"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createGame,
  updateGame,
  searchIcons,
  type Game,
  type IconCandidate,
} from "@/lib/api/scoreboard";
import { COLOR_TOKENS, colorStyles } from "./palette";

const iconPreviewUrl = (slug: string) =>
  `https://raw.githubusercontent.com/game-icons/icons/master/${slug}.svg`;

// Safety net when the GitHub-backed search is down: a known-good
// game-icons slug the backend can always try to fetch directly.
const FALLBACK_ICON: IconCandidate = {
  slug: "delapouite/trophy-cup",
  previewUrl: iconPreviewUrl("delapouite/trophy-cup"),
};

const inputClass =
  "w-full rounded-md border border-white/20 bg-black/30 px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:border-white/40 focus:outline-none";

/**
 * Create or edit a game (SHAN-436). Passing `game` switches the form to edit
 * mode: fields are prefilled and submitting sends a PATCH carrying only the
 * fields that actually changed, since the API rejects an empty patch.
 */
export function GameForm({
  game,
  onSaved,
  onCancel,
}: {
  game?: Game;
  onSaved: () => Promise<void>;
  onCancel?: () => void;
}) {
  const editing = !!game;
  const [name, setName] = useState(game?.name ?? "");
  const [description, setDescription] = useState(game?.description ?? "");
  const [rules, setRules] = useState(game?.rules ?? "");
  const [color, setColor] = useState<string | null>(game?.color ?? null);
  const [candidates, setCandidates] = useState<IconCandidate[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(
    game?.icon.slug ?? null,
  );
  const [iconQuery, setIconQuery] = useState("");
  // In add mode the name drives an automatic art lookup. In edit mode that
  // stays off for good: renaming a game must never silently swap the art it
  // already has, so changing the art there means typing in the art search.
  const [searchEnabled, setSearchEnabled] = useState(!editing);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // The icon search follows the name field unless an explicit icon query
  // was typed ("auto find" with a manual override).
  const effectiveQuery = iconQuery.trim() || name.trim();

  useEffect(() => {
    if (!searchEnabled || effectiveQuery.length < 2) {
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
  }, [effectiveQuery, searchEnabled]);

  // Before any search runs the grid shows the game's current art in edit
  // mode, and the fallback trophy in add mode.
  const shownCandidates = useMemo(() => {
    if (candidates.length > 0) return candidates;
    if (game) {
      return [{ slug: game.icon.slug, previewUrl: iconPreviewUrl(game.icon.slug) }];
    }
    return [FALLBACK_ICON];
  }, [candidates, game]);

  const defaultSlug = game?.icon.slug ?? FALLBACK_ICON.slug;
  const isSelected = (slug: string) =>
    selectedSlug === slug || (selectedSlug === null && slug === defaultSlug);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const slug = selectedSlug ?? defaultSlug;
    const trimmed = {
      name: name.trim(),
      description: description.trim() || null,
      rules: rules.trim() || null,
    };
    setSaving(true);
    setError(null);
    try {
      if (game) {
        const patch: Parameters<typeof updateGame>[1] = {};
        if (trimmed.name !== game.name) patch.name = trimmed.name;
        if (trimmed.description !== game.description)
          patch.description = trimmed.description;
        if (trimmed.rules !== game.rules) patch.rules = trimmed.rules;
        if (slug !== game.icon.slug) patch.iconSlug = slug;
        if (color && color !== game.color) patch.color = color;
        // An untouched form is a no-op rather than a 400 "at least one field".
        if (Object.keys(patch).length > 0) await updateGame(game.id, patch);
      } else {
        await createGame({
          ...trimmed,
          iconSlug: slug,
          color: color ?? undefined,
        });
      }
      await onSaved();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Could not ${editing ? "save" : "create"} the game`,
      );
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4"
    >
      <h2 className="text-lg font-medium">{editing ? "Edit game" : "New game"}</h2>
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      <label className="block text-sm text-gray-300">
        Name
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!editing) setSearchEnabled(true);
          }}
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
            onChange={(e) => {
              setIconQuery(e.target.value);
              setSearchEnabled(true);
            }}
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
          {shownCandidates.map((cand) => (
            <button
              key={cand.slug}
              type="button"
              role="option"
              aria-selected={isSelected(cand.slug)}
              onClick={() => setSelectedSlug(cand.slug)}
              className={`rounded-md border p-1 ${
                isSelected(cand.slug)
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

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={saving || name.trim().length === 0}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-white px-4 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-50"
        >
          {saving
            ? editing
              ? "Saving..."
              : "Adding..."
            : editing
              ? "Save changes"
              : "Add game"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-white/10 px-4 text-sm text-gray-200 hover:bg-white/15"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
