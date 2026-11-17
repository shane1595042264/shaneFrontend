"use client";

import { useEffect, useState } from "react";
import {
  updateEntry,
  LONG_TERM_THRESHOLD,
  type KnowledgeEntry,
} from "@/lib/knowledge-api";
import { listLocations, upsertLocation, type Location } from "@/lib/api/practice";
import { humanizeActionError } from "@/lib/humanize-error";

interface Props {
  entry: KnowledgeEntry;
  /** Whether the current user may edit this card (mirrors PUT ownership rule). */
  canEdit: boolean;
  onUpdated: (entry: KnowledgeEntry) => void;
}

/**
 * Location-memorization technique (SHAN-339). Marks the distinct places this card
 * has been practiced. Practicing at LONG_TERM_THRESHOLD (7) different locations
 * flips the card to "long-term memorized" (computed server-side).
 */
export function MemorizationLocations({ entry, canEdit, onUpdated }: Props) {
  const current = entry.memorizationLocations ?? [];
  const [suggestions, setSuggestions] = useState<Location[]>([]);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canEdit) return;
    listLocations()
      .then(setSuggestions)
      .catch(() => {
        /* suggestions are optional — the free-text input still works */
      });
  }, [canEdit]);

  // SHAN-556: send the change, not the whole list. `current` is the copy this
  // panel loaded, so a full list would erase any place practice mode recorded
  // since; the server applies the delta to the stored row and returns the merge.
  async function commit(delta: {
    addMemorizationLocations?: string[];
    removeMemorizationLocations?: string[];
  }): Promise<boolean> {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateEntry(entry.id, delta);
      onUpdated(updated);
      return true;
    } catch (e) {
      setError(humanizeActionError(e, "Failed to update locations"));
      return false;
    } finally {
      setSaving(false);
    }
  }

  // SHAN-623: `fromInput` is false for a suggestion chip, which must leave
  // whatever is typed in the box alone. A typed add clears the box only once
  // it has saved, so a failed save keeps the text for a retry.
  async function add(name: string, fromInput: boolean) {
    const trimmed = name.trim();
    if (!trimmed) return;
    // De-dupe case-insensitively against what's already on the card.
    if (current.some((l) => l.toLowerCase() === trimmed.toLowerCase())) {
      if (fromInput) setInput("");
      return;
    }
    // Register it as a practice location too so it shows up as a suggestion
    // later; tolerate failure — the card update below is what actually matters.
    upsertLocation(trimmed).catch(() => {});
    const saved = await commit({ addMemorizationLocations: [trimmed] });
    if (saved && fromInput) setInput("");
  }

  function remove(name: string) {
    void commit({ removeMemorizationLocations: [name] });
  }

  const unusedSuggestions = suggestions.filter(
    (s) => !current.some((l) => l.toLowerCase() === s.name.toLowerCase())
  );

  const count = Math.min(current.length, LONG_TERM_THRESHOLD);

  return (
    <section aria-labelledby="memorized-at-heading">
      <div className="flex items-baseline justify-between gap-4">
        <h3 id="memorized-at-heading" className="text-sm font-medium text-white">
          Memorized at
        </h3>
        <p className="font-mono text-xs tabular-nums text-gray-400">
          {entry.longTermMemorized ? (
            <span className="text-teal-200">Long-term memorized</span>
          ) : (
            <>
              {count} of {LONG_TERM_THRESHOLD} places
            </>
          )}
        </p>
      </div>

      {/* SHAN-339: seven distinct places makes a card long-term. One segment
          per place, the same strip recite draws across a sitting. */}
      <div aria-hidden="true" className="mt-3 flex gap-1">
        {Array.from({ length: LONG_TERM_THRESHOLD }).map((_, i) => (
          <div
            key={i}
            className={`h-[3px] flex-1 rounded-full transition-colors duration-500 ${
              i < count ? "bg-teal-300/90" : "bg-white/[0.08]"
            }`}
          />
        ))}
      </div>

      {current.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {current.map((name) => (
            <li
              key={name}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-teal-400/[0.08] pl-3 pr-1.5 text-sm text-teal-100 ring-1 ring-inset ring-teal-300/20"
            >
              {name}
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => remove(name)}
                  disabled={saving}
                  aria-label={`Remove ${name}`}
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full text-teal-200/70 transition-colors hover:bg-red-500/15 hover:text-red-300 disabled:opacity-50"
                >
                  &times;
                </button>
              ) : (
                <span className="w-1.5" aria-hidden="true" />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-gray-400">
          {canEdit
            ? "Practice it somewhere, or mark a place you already know it by heart."
            : "No places marked yet."}
        </p>
      )}

      {canEdit && (
        <div className="mt-4 rounded-xl bg-white/[0.025] p-3 ring-1 ring-inset ring-white/[0.06]">
          {unusedSuggestions.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {unusedSuggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={saving}
                  onClick={() => add(s.name, false)}
                  className="inline-flex h-8 items-center rounded-full px-3 text-sm text-gray-300 ring-1 ring-inset ring-white/10 transition-[background-color,color,transform] hover:bg-white/[0.06] hover:text-white active:scale-[0.98] disabled:opacity-50"
                >
                  <span aria-hidden="true" className="mr-1 text-gray-400">
                    +
                  </span>
                  {s.name}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add(input, true);
                }
              }}
              aria-label="Add a location"
              // The server caps a location at 120 characters (knowledge PUT
              // and POST /api/practice/locations alike).
              maxLength={120}
              placeholder="Somewhere new"
              disabled={saving}
              className="h-9 min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.03] px-4 text-sm text-white placeholder:text-gray-400 transition-colors focus:border-white/25 focus:outline-none disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => add(input, true)}
              disabled={saving || !input.trim()}
              className="inline-flex h-9 shrink-0 items-center rounded-full px-4 text-sm text-gray-300 ring-1 ring-inset ring-white/10 transition-[background-color,color,transform] hover:bg-white/[0.06] hover:text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Mark
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-300">
          {error}
        </p>
      )}
    </section>
  );
}
