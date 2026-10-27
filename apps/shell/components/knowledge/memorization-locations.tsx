"use client";

import { useEffect, useState } from "react";
import {
  updateEntry,
  LONG_TERM_THRESHOLD,
  type KnowledgeEntry,
} from "@/lib/knowledge-api";
import { listLocations, upsertLocation, type Location } from "@/lib/api/practice";

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
      setError((e as Error)?.message ?? "Failed to update locations");
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

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-xs text-gray-400 uppercase">Memorization Locations</h3>
        <span className="text-xs text-gray-400">
          {Math.min(current.length, LONG_TERM_THRESHOLD)}/{LONG_TERM_THRESHOLD}
        </span>
        {entry.longTermMemorized && (
          <span className="text-xs px-1.5 py-0.5 border border-emerald-500/30 rounded text-emerald-400">
            🧠 Long-term memorized
          </span>
        )}
      </div>

      {current.length > 0 ? (
        <div className="flex flex-wrap gap-1 mb-2">
          {current.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-emerald-300"
            >
              {name}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => remove(name)}
                  disabled={saving}
                  aria-label={`Remove ${name}`}
                  className="text-emerald-400/70 hover:text-red-400 disabled:opacity-50"
                >
                  &times;
                </button>
              )}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 mb-2">
          {canEdit
            ? "Practice this card somewhere, then mark the location here."
            : "No locations marked yet."}
        </p>
      )}

      {canEdit && (
        <>
          {unusedSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {unusedSuggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={saving}
                  onClick={() => add(s.name, false)}
                  className="text-xs px-2 py-0.5 border border-white/15 rounded text-gray-400 hover:bg-white/10 disabled:opacity-50"
                >
                  + {s.name}
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
              placeholder="Add a location…"
              disabled={saving}
              className="flex-1 px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white focus:outline-none focus:border-white/20 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => add(input, true)}
              disabled={saving || !input.trim()}
              className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white rounded transition-colors"
            >
              Add
            </button>
          </div>
        </>
      )}

      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
