"use client";

import type { VocabWord } from "@/lib/vocabulary-api";

const LANGUAGE_COLORS: Record<string, string> = {
  english: "border-blue-500/30 text-blue-400",
  chinese: "border-red-500/30 text-red-400",
  spanish: "border-yellow-500/30 text-yellow-400",
  french: "border-purple-500/30 text-purple-400",
};

function getLangStyle(language: string) {
  return LANGUAGE_COLORS[language.toLowerCase()] || "border-gray-500/30 text-gray-400";
}

interface WordCardProps {
  word: VocabWord;
  onClick: (word: VocabWord) => void;
  onDelete: (id: string) => void;
}

export function WordCard({ word, onClick, onDelete }: WordCardProps) {
  const langStyle = getLangStyle(word.language);

  return (
    <div
      onClick={() => onClick(word)}
      className="group relative p-4 bg-white/5 border border-white/8 rounded-lg cursor-pointer hover:bg-white/8 hover:border-white/15 transition-all"
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(word.id);
        }}
        className="absolute top-2 right-2 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
      >
        &times;
      </button>

      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-lg font-semibold text-white">{word.word}</span>
        {word.pronunciation && (
          <span className="text-xs text-gray-500">{word.pronunciation}</span>
        )}
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span
          className={`text-xs px-1.5 py-0.5 border rounded ${langStyle}`}
        >
          {word.language}
        </span>
        {word.partOfSpeech && (
          <span className="text-xs text-gray-500 italic">
            {word.partOfSpeech}
          </span>
        )}
      </div>

      {word.definition && (
        <p className="text-sm text-gray-400 mb-2 line-clamp-2">
          {word.definition}
        </p>
      )}

      {(word.labels as string[])?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {(word.labels as string[]).map((label) => (
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
