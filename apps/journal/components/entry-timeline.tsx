"use client";

import { motion } from "framer-motion";
import type { DiaryEntry } from "@shane/types";
import { EntryCard } from "@/components/entry-card";

interface EntryTimelineProps {
  entries: DiaryEntry[];
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

export function EntryTimeline({ entries }: EntryTimelineProps) {
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
  );
}
