"use client";

import { useState } from "react";
import type { DiaryEntry, NormalizedActivity } from "@shane/types";
import { DataHighlight } from "@/components/journal/data-highlight";
import { ActivityBreakdown } from "@/components/journal/activity-breakdown";

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

interface EntryRendererProps {
  entry: DiaryEntry;
  activities?: NormalizedActivity[];
  suggestionOpen?: boolean;
  onToggleSuggestion?: () => void;
}

export function EntryRenderer({
  entry,
  activities = [],
  suggestionOpen = false,
  onToggleSuggestion,
}: EntryRendererProps) {
  const [content] = useState(entry.content);

  const paragraphs = content.split("\n").filter((p) => p.trim().length > 0);

  return (
    <article
      id={`entry-${entry.date}`}
      className="relative border-b border-white/8 pb-8 mb-8 last:border-0 last:mb-0 group"
    >
      {/* Date header with suggestion icon in the margin */}
      <div className="flex items-start justify-between mb-3">
        <h2 className="text-base font-semibold text-white/80 tracking-tight">
          {formatDateHeader(entry.date)}
        </h2>

        {/* Suggestion icon — appears on hover or when active */}
        <button
          onClick={onToggleSuggestion}
          title="Suggest a correction"
          className={`ml-3 flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-xs transition-all ${
            suggestionOpen
              ? "bg-blue-600 text-white opacity-100"
              : "bg-transparent text-gray-600 opacity-0 group-hover:opacity-100 hover:bg-white/10 hover:text-gray-300"
          }`}
        >
          ✎
        </button>
      </div>

      {/* Entry content */}
      <div className="space-y-3">
        {paragraphs.map((para, i) => (
          <p key={i} className="text-gray-300 leading-relaxed text-sm">
            <DataHighlight text={para} />
          </p>
        ))}
      </div>

      {/* Activity breakdown — inline toggle */}
      {activities.length > 0 && (
        <div className="mt-4">
          <ActivityBreakdown activities={activities} />
        </div>
      )}
    </article>
  );
}
