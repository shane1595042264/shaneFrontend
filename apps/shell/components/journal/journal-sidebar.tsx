"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getYearMonthDay(dateStr: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateStr.split("-").map(Number);
  return { year: y, month: m, day: d };
}

interface JournalSidebarProps {
  dates: string[]; // YYYY-MM-DD strings, sorted newest-first
  activeDate: string | null;
  onSelectDate: (date: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  totalCount: number; // total entries before filtering
}

type Tree = Record<number, Record<number, number[]>>; // year -> month -> days[]

function buildTree(dates: string[]): Tree {
  const tree: Tree = {};
  for (const d of dates) {
    const { year, month, day } = getYearMonthDay(d);
    if (!tree[year]) tree[year] = {};
    if (!tree[year][month]) tree[year][month] = [];
    tree[year][month].push(day);
  }
  return tree;
}

export function JournalSidebar({ dates, activeDate, onSelectDate, searchQuery, onSearchChange, totalCount }: JournalSidebarProps) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1; // 1-indexed

  const tree = buildTree(dates);

  // Years are collapsed by default except current year
  const [expandedYears, setExpandedYears] = useState<Set<number>>(
    () => new Set([currentYear])
  );
  // Current month is expanded by default
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(
    () => new Set([`${currentYear}-${currentMonth}`])
  );

  const toggleYear = useCallback((year: number) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  }, []);

  const toggleMonth = useCallback((key: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const years = Object.keys(tree)
    .map(Number)
    .sort((a, b) => b - a); // newest first

  if (dates.length === 0 && !searchQuery) {
    return (
      <aside className="w-44 flex-shrink-0 text-xs text-gray-500 pt-2 pl-1">
        No entries yet.
      </aside>
    );
  }

  return (
    <aside className="w-44 flex-shrink-0 text-xs select-none overflow-y-auto">
      {/* Search input */}
      <div className="sticky top-0 bg-gray-950 z-10 px-2 pt-2 pb-1">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search entries..."
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-blue-500 pr-6"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-sm leading-none"
            >
              ✕
            </button>
          )}
        </div>
        {searchQuery && (
          <div className="text-gray-500 mt-1 px-0.5">
            {dates.length} of {totalCount} entries
          </div>
        )}
      </div>

      <div className="space-y-1 py-1">
        {searchQuery && years.length === 0 && (
          <div className="text-gray-600 text-center py-4 px-2">No matching entries</div>
        )}
        {years.map((year) => {
          const yearOpen = searchQuery ? true : expandedYears.has(year);
          const months = Object.keys(tree[year])
            .map(Number)
            .sort((a, b) => b - a);

          return (
            <div key={year}>
              {/* Year header */}
              <button
                onClick={() => toggleYear(year)}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded text-left text-gray-400 hover:text-white hover:bg-white/8 transition-colors font-semibold tracking-wide"
              >
                <span className="flex items-center gap-1.5">
                  {year}
                  <span className="text-[10px] text-gray-600 font-normal">
                    {Object.values(tree[year]).reduce((sum, days) => sum + days.length, 0)}
                  </span>
                </span>
                <span className="text-gray-600 text-[10px]">{yearOpen ? "▾" : "▸"}</span>
              </button>

              <AnimatePresence initial={false}>
                {yearOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    {months.map((month) => {
                      const monthKey = `${year}-${month}`;
                      const monthOpen = searchQuery ? true : expandedMonths.has(monthKey);
                      const days = tree[year][month].sort((a, b) => b - a);

                      return (
                        <div key={month} className="ml-2">
                          {/* Month header */}
                          <button
                            onClick={() => toggleMonth(monthKey)}
                            className="w-full flex items-center justify-between px-2 py-1 rounded text-left text-gray-500 hover:text-gray-300 hover:bg-white/6 transition-colors"
                          >
                            <span className="flex items-center gap-1.5">
                              {MONTH_NAMES[month - 1]}
                              <span className="text-[10px] text-gray-600">
                                {days.length}
                              </span>
                            </span>
                            <span className="text-gray-600 text-[10px]">{monthOpen ? "▾" : "▸"}</span>
                          </button>

                          <AnimatePresence initial={false}>
                            {monthOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.15, ease: "easeInOut" }}
                                className="overflow-hidden"
                              >
                                {days.map((day) => {
                                  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                                  const isActive = dateStr === activeDate;

                                  return (
                                    <button
                                      key={day}
                                      onClick={() => onSelectDate(dateStr)}
                                      className={`w-full text-left px-3 py-1 rounded transition-colors ${
                                        isActive
                                          ? "bg-blue-600/30 text-blue-300 font-semibold"
                                          : "text-gray-500 hover:text-gray-200 hover:bg-white/6"
                                      }`}
                                    >
                                      {day}
                                    </button>
                                  );
                                })}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
