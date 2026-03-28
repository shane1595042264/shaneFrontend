"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { DiaryEntry, NormalizedActivity } from "@shane/types";
import { DataHighlight } from "@/components/journal/data-highlight";
import { ActivityBreakdown } from "@/components/journal/activity-breakdown";
import { SuggestionChat } from "@/components/journal/suggestion-chat";

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
}

export function EntryRenderer({ entry, activities = [] }: EntryRendererProps) {
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [content, setContent] = useState(entry.content);

  const paragraphs = content.split("\n").filter((p) => p.trim().length > 0);

  return (
    <article
      id={`entry-${entry.date}`}
      className="relative border-b border-white/8 pb-10 mb-10 last:border-0 last:mb-0"
    >
      {/* Date header */}
      <div className="flex items-start justify-between mb-4 group">
        <h2 className="text-lg font-semibold text-white tracking-tight">
          {formatDateHeader(entry.date)}
        </h2>

        {/* Comment / suggestion icon — floats on the right */}
        <button
          onClick={() => setSuggestionOpen((v) => !v)}
          title="Suggest a correction"
          className={`ml-4 mt-0.5 flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs transition-colors ${
            suggestionOpen
              ? "bg-blue-600 text-white"
              : "bg-white/8 text-gray-500 hover:bg-white/15 hover:text-gray-300"
          }`}
        >
          ✎
        </button>
      </div>

      {/* Entry content */}
      <div className="space-y-4 pr-10">
        {paragraphs.map((para, i) => (
          <p key={i} className="text-gray-200 leading-relaxed">
            <DataHighlight text={para} />
          </p>
        ))}
      </div>

      {/* Suggestion panel — slides in below entry */}
      <AnimatePresence>
        {suggestionOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="mt-6 pr-10"
          >
            <SuggestionChat
              date={entry.date}
              onCorrected={(corrected) => {
                setContent(corrected);
                setSuggestionOpen(false);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Activity breakdown toggle */}
      {activities.length > 0 && (
        <div className="mt-6 pr-10">
          <ActivityBreakdown activities={activities} />
        </div>
      )}
    </article>
  );
}
