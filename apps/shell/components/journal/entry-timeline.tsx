"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import type { DiaryEntry } from "@shane/types";
import { EntryCard } from "@/components/journal/entry-card";
import { fetchEntries } from "@/lib/journal-api";

interface EntryTimelineProps {
  entries: DiaryEntry[];
  total: number;
  limit: number;
}

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export function EntryTimeline({ entries: initialEntries, total, limit }: EntryTimelineProps) {
  const [entries, setEntries] = useState(initialEntries);
  const [loading, setLoading] = useState(false);

  const hasMore = entries.length < total;

  const loadMore = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchEntries({ limit, offset: entries.length });
      setEntries((prev) => [...prev, ...data.entries]);
    } finally {
      setLoading(false);
    }
  }, [entries.length, limit]);

  if (entries.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 text-sm">No journal entries yet.</p>
        <p className="text-gray-600 text-xs mt-1">
          Entries will appear here once generated.
        </p>
      </div>
    );
  }

  return (
    <div>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-4"
      >
        {entries.map((entry) => (
          <motion.div key={entry.id} variants={itemVariants}>
            <EntryCard entry={entry} />
          </motion.div>
        ))}
      </motion.div>

      {hasMore && (
        <div className="flex justify-center mt-8">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-6 py-2 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Loading…" : "Load More"}
          </button>
        </div>
      )}
    </div>
  );
}
