"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { DiaryEntry } from "@shane/types";

interface EntryCardProps {
  entry: DiaryEntry;
}

function formatDate(dateStr: string): { date: string; dayOfWeek: string } {
  const d = new Date(dateStr + "T00:00:00");
  return {
    date: d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    dayOfWeek: d.toLocaleDateString("en-US", { weekday: "long" }),
  };
}

export function EntryCard({ entry }: EntryCardProps) {
  const { date, dayOfWeek } = formatDate(entry.date);
  const preview = entry.content.slice(0, 200).trim();
  const truncated = entry.content.length > 200;

  return (
    <Link href={`/journal/entry/${entry.date}`}>
      <motion.div
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        className="block p-5 rounded-xl border border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8 transition-colors cursor-pointer"
      >
        <div className="mb-2">
          <span className="text-xs font-medium text-blue-400 uppercase tracking-wide">
            {dayOfWeek}
          </span>
          <h2 className="text-base font-semibold text-white">{date}</h2>
        </div>
        <p className="text-sm text-gray-400 leading-relaxed line-clamp-3">
          {preview}
          {truncated && "…"}
        </p>
      </motion.div>
    </Link>
  );
}
