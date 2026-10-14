"use client";

import type { MouseEvent, ReactNode } from "react";
import { LONG_TERM_THRESHOLD, type KnowledgeEntry } from "@/lib/knowledge-api";

/** Location chips shown on a card preview before collapsing the rest into "+N more". */
const MAX_PREVIEW_LOCATIONS = 4;
/** Labels shown before the rest collapse into "+N". */
const MAX_PREVIEW_LABELS = 4;

/**
 * Languages that say nothing about a card. The classifier files most concept
 * cards under "general", and printing that on 40 cards was noise, not a fact.
 */
const UNINFORMATIVE_LANGUAGES = new Set(["general", "n/a", "none", ""]);

interface EntryCardProps {
  entry: KnowledgeEntry;
  index: number;
  onClick: (entry: KnowledgeEntry) => void;
  onDelete: (id: string) => void;
  deleting?: boolean;
  canDelete: boolean;
  editMode: boolean;
  selected: boolean;
  onToggleSelect: (index: number, shiftKey: boolean) => void;
  /** Filter the grid by a memorization location clicked on this card (SHAN-486). */
  onSelectLocation?: (location: string) => void;
  actions?: ReactNode;
}

/**
 * Seven ticks, one per place the card has been memorized at (SHAN-339): the
 * whole long-term rule drawn at a glance, where the old "📍 3/7" needed reading.
 */
function MemoryMeter({ count, longTerm }: { count: number; longTerm: boolean }) {
  const filled = Math.min(count, LONG_TERM_THRESHOLD);
  const label = longTerm
    ? `Long-term memorized: practiced at ${count} places`
    : `Memorized at ${count} of ${LONG_TERM_THRESHOLD} places needed for long-term`;
  return (
    <span className="flex shrink-0 items-center gap-2" title={label}>
      <span className="sr-only">{label}</span>
      {longTerm && (
        <span aria-hidden="true" className="text-[11px] font-medium text-teal-300">
          Long-term
        </span>
      )}
      <span aria-hidden="true" className="flex gap-[3px]">
        {Array.from({ length: LONG_TERM_THRESHOLD }).map((_, i) => (
          <span
            key={i}
            className={`h-1 w-2 rounded-full ${i < filled ? "bg-teal-300/90" : "bg-white/[0.1]"}`}
          />
        ))}
      </span>
    </span>
  );
}

export function EntryCard({
  entry,
  index,
  onClick,
  onDelete,
  deleting,
  canDelete,
  editMode,
  selected,
  onToggleSelect,
  onSelectLocation,
  actions,
}: EntryCardProps) {
  // SHAN-486: surface the memorization locations on the preview card, not just in
  // the detail panel. Older rows can come back without the jsonb column populated.
  const locations = entry.memorizationLocations ?? [];
  const visibleLocations = locations.slice(0, MAX_PREVIEW_LOCATIONS);
  const hiddenLocationCount = locations.length - visibleLocations.length;
  const labels = ((entry.labels as string[]) ?? []).filter(Boolean);
  const showLanguage =
    !UNINFORMATIVE_LANGUAGES.has(entry.language.trim().toLowerCase()) &&
    entry.language.trim().toLowerCase() !== entry.category.trim().toLowerCase();

  function handleCardClick(e: MouseEvent<HTMLDivElement>) {
    if (editMode) {
      // In edit mode the whole card acts as a checkbox row; shift-click selects ranges.
      onToggleSelect(index, e.shiftKey);
      return;
    }
    onClick(entry);
  }

  // SHAN-576: .spot is the site's pointer-lit card (components/aura.tsx writes
  // its light coordinates), so these cards match the homepage's instead of
  // being the one flat grid left on the site.
  const cardClasses = [
    "spot group relative flex h-full cursor-pointer flex-col rounded-xl border p-4 transition-[background-color,border-color]",
    editMode && selected
      ? "border-blue-400/50 bg-blue-500/[0.12] hover:bg-blue-500/[0.16]"
      : "border-white/[0.08] bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.04]",
  ].join(" ");

  return (
    <div
      onClick={handleCardClick}
      className={cardClasses}
      role={editMode ? "checkbox" : undefined}
      aria-checked={editMode ? selected : undefined}
      aria-label={editMode ? `Select ${entry.word}` : undefined}
    >
      {editMode ? (
        <div
          className={`absolute top-3 right-3 w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
            selected
              ? "bg-blue-500 border-blue-400 text-white"
              : "bg-white/5 border-white/20 text-transparent"
          }`}
          aria-hidden="true"
        >
          {selected ? "✓" : ""}
        </div>
      ) : canDelete ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!deleting) onDelete(entry.id);
          }}
          disabled={deleting}
          aria-label={deleting ? "Deleting entry" : "Delete entry"}
          className={`absolute top-2.5 right-3 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity text-sm ${
            deleting ? "text-gray-400 cursor-not-allowed" : "text-gray-400 hover:text-red-400"
          }`}
        >
          {deleting ? "..." : "×"}
        </button>
      ) : null}

      <div className="flex items-baseline gap-2 pr-6">
        <span className="text-[17px] font-semibold leading-snug tracking-[-0.01em] text-white">
          {entry.word}
        </span>
        {entry.pronunciation && (
          <span className="font-mono text-xs text-gray-400">{entry.pronunciation}</span>
        )}
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-2.5 text-xs text-gray-400">
        <span className="capitalize text-gray-300">{entry.category}</span>
        {showLanguage && <span>{entry.language}</span>}
        {entry.partOfSpeech && <span className="italic">{entry.partOfSpeech}</span>}
      </div>

      {entry.definition && (
        <p className="mt-2.5 line-clamp-3 text-sm leading-relaxed text-gray-300">
          {entry.definition}
        </p>
      )}

      {labels.length > 0 && (
        <p className="mt-3 flex flex-wrap gap-x-2.5 gap-y-1 text-xs text-gray-400">
          {labels.slice(0, MAX_PREVIEW_LABELS).map((label) => (
            <span key={label}>#{label}</span>
          ))}
          {labels.length > MAX_PREVIEW_LABELS && (
            <span title={labels.slice(MAX_PREVIEW_LABELS).join(", ")}>
              +{labels.length - MAX_PREVIEW_LABELS}
            </span>
          )}
        </p>
      )}

      {locations.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {visibleLocations.map((name) =>
            onSelectLocation && !editMode ? (
              <button
                key={name}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectLocation(name);
                }}
                title={`Show only cards memorized at ${name}`}
                className="rounded-full bg-teal-400/[0.07] px-2 py-0.5 text-xs text-teal-200 ring-1 ring-inset ring-teal-300/15 transition-colors hover:bg-teal-400/[0.14]"
              >
                {name}
              </button>
            ) : (
              <span
                key={name}
                className="rounded-full bg-teal-400/[0.07] px-2 py-0.5 text-xs text-teal-200 ring-1 ring-inset ring-teal-300/15"
              >
                {name}
              </span>
            )
          )}
          {hiddenLocationCount > 0 && (
            <span className="text-xs text-gray-400" title={locations.slice(MAX_PREVIEW_LOCATIONS).join(", ")}>
              +{hiddenLocationCount} more
            </span>
          )}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <div className="flex min-w-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
        <MemoryMeter count={locations.length} longTerm={entry.longTermMemorized} />
      </div>
    </div>
  );
}
