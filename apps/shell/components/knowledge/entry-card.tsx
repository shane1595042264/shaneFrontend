"use client";

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
  onClick: (entry: KnowledgeEntry) => void;
  onDelete: (id: string) => void;
  deleting?: boolean;
}

export function EntryCard({ entry, onClick, onDelete, deleting }: EntryCardProps) {
  return (
    <div
      onClick={() => onClick(entry)}
      className="group relative p-4 bg-white/5 border border-white/8 rounded-lg cursor-pointer hover:bg-white/8 hover:border-white/15 transition-all"
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (!deleting) onDelete(entry.id);
        }}
        disabled={deleting}
        aria-label={deleting ? "Deleting entry" : "Delete entry"}
        className={`absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-xs ${
          deleting
            ? "text-gray-600 cursor-not-allowed"
            : "text-gray-600 hover:text-red-400"
        }`}
      >
        {deleting ? "..." : "\u00d7"}
      </button>

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
    </div>
  );
}
