"use client";

import type { MouseEvent, ReactNode } from "react";
import type { KnowledgeEntry } from "@/lib/knowledge-api";

const CATEGORY_BADGE: Record<string, string> = {
  vocabulary: "border-blue-500/30 text-blue-400",
  coding: "border-green-500/30 text-green-400",
  general: "border-gray-500/30 text-gray-400",
};

const LANGUAGE_COLORS: Record<string, string> = {
  english: "border-blue-500/30 text-blue-400",
  chinese: "border-red-500/30 text-red-400",
  spanish: "border-yellow-500/30 text-yellow-400",
  french: "border-purple-500/30 text-purple-400",
  typescript: "border-blue-400/30 text-blue-300",
  javascript: "border-yellow-400/30 text-yellow-300",
  python: "border-green-400/30 text-green-300",
};

function getLangStyle(language: string) {
  return LANGUAGE_COLORS[language.toLowerCase()] || "border-gray-500/30 text-gray-400";
}

function getCategoryBadge(category: string) {
  return CATEGORY_BADGE[category] || "border-purple-500/30 text-purple-400";
}

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
  actions?: ReactNode;
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
  actions,
}: EntryCardProps) {
  function handleCardClick(e: MouseEvent<HTMLDivElement>) {
    if (editMode) {
      // In edit mode the whole card acts as a checkbox row; shift-click selects ranges.
      onToggleSelect(index, e.shiftKey);
      return;
    }
    onClick(entry);
  }

  const cardClasses = [
    "group relative p-4 border rounded-lg cursor-pointer transition-all",
    editMode
      ? selected
        ? "bg-blue-500/15 border-blue-400/50 hover:bg-blue-500/20"
        : "bg-white/5 border-white/8 hover:bg-white/8 hover:border-white/15"
      : "bg-white/5 border-white/8 hover:bg-white/8 hover:border-white/15",
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
          className={`absolute top-2 right-2 w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
            selected
              ? "bg-blue-500 border-blue-400 text-white"
              : "bg-white/5 border-white/20 text-transparent"
          }`}
          aria-hidden="true"
        >
          {selected ? "\u2713" : ""}
        </div>
      ) : canDelete ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!deleting) onDelete(entry.id);
          }}
          disabled={deleting}
          aria-label={deleting ? "Deleting entry" : "Delete entry"}
          className={`absolute top-2 right-2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity text-xs ${
            deleting
              ? "text-gray-600 cursor-not-allowed"
              : "text-gray-600 hover:text-red-400"
          }`}
        >
          {deleting ? "..." : "\u00d7"}
        </button>
      ) : null}

      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-lg font-semibold text-white">{entry.word}</span>
        {entry.pronunciation && (
          <span className="text-xs text-gray-500">{entry.pronunciation}</span>
        )}
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span
          className={`text-xs px-1.5 py-0.5 border rounded capitalize ${getCategoryBadge(entry.category)}`}
        >
          {entry.category}
        </span>
        <span
          className={`text-xs px-1.5 py-0.5 border rounded ${getLangStyle(entry.language)}`}
        >
          {entry.language}
        </span>
        {entry.partOfSpeech && (
          <span className="text-xs text-gray-500 italic">
            {entry.partOfSpeech}
          </span>
        )}
      </div>

      {entry.definition && (
        <p className="text-sm text-gray-400 mb-2 line-clamp-2">
          {entry.definition}
        </p>
      )}

      {(entry.labels as string[])?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {(entry.labels as string[]).map((label) => (
            <span
              key={label}
              className="text-xs px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-gray-500"
            >
              {label}
            </span>
          ))}
        </div>
      )}
      {actions && (
        <div className="mt-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      )}
    </div>
  );
}
