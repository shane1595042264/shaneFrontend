"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { DiaryEntry } from "@shane/types";
import { EntryRenderer } from "@/components/journal/entry-renderer";
import { JournalSidebar } from "@/components/journal/journal-sidebar";

interface JournalDocumentProps {
  entries: DiaryEntry[];
}

function groupByYear(entries: DiaryEntry[]): Record<number, DiaryEntry[]> {
  const groups: Record<number, DiaryEntry[]> = {};
  for (const entry of entries) {
    const year = Number(entry.date.slice(0, 4));
    if (!groups[year]) groups[year] = [];
    groups[year].push(entry);
  }
  return groups;
}

export function JournalDocument({ entries }: JournalDocumentProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Active date for sidebar highlight — defaults to most recent entry
  const [activeDate, setActiveDate] = useState<string | null>(
    entries.length > 0 ? entries[0].date : null
  );

  // Scroll content area to entry when sidebar item is clicked
  const handleSelectDate = useCallback((date: string) => {
    setActiveDate(date);
    const el = document.getElementById(`entry-${date}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // IntersectionObserver: update active date as user scrolls
  useEffect(() => {
    if (!contentRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible entry
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible.length > 0) {
          const id = visible[0].target.id; // entry-YYYY-MM-DD
          const date = id.replace("entry-", "");
          setActiveDate(date);
        }
      },
      {
        root: null,
        rootMargin: "-10% 0px -70% 0px", // trigger when entry enters top portion of viewport
        threshold: 0,
      }
    );

    const articles = contentRef.current.querySelectorAll("article[id^='entry-']");
    articles.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [entries]);

  const dates = entries.map((e) => e.date);

  if (entries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center py-32">
        <div className="text-center">
          <p className="text-gray-500 text-sm">No journal entries yet.</p>
          <p className="text-gray-600 text-xs mt-1">
            Entries will appear here once generated.
          </p>
        </div>
      </div>
    );
  }

  const yearGroups = groupByYear(entries);
  const years = Object.keys(yearGroups)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <div className="flex gap-6 min-h-0">
      {/* Sidebar */}
      <JournalSidebar
        dates={dates}
        activeDate={activeDate}
        onSelectDate={handleSelectDate}
      />

      {/* Divider */}
      <div className="w-px bg-white/8 flex-shrink-0" />

      {/* Main scrollable document */}
      <div
        ref={contentRef}
        className="flex-1 min-w-0 overflow-y-auto"
        style={{ maxHeight: "calc(100vh - 140px)" }}
      >
        {years.map((year) => (
          <div key={year}>
            {/* Year heading */}
            <div className="flex items-center gap-3 mb-8 mt-2">
              <span className="text-2xl font-bold text-white/20 tracking-widest select-none">
                {year}
              </span>
              <div className="flex-1 h-px bg-white/8" />
            </div>

            {yearGroups[year].map((entry) => (
              <EntryRenderer key={entry.id} entry={entry} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
