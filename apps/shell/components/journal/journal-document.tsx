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

  const [activeDate, setActiveDate] = useState<string | null>(
    entries.length > 0 ? entries[0].date : null
  );

  // Which entry has the suggestion panel open
  const [suggestionDate, setSuggestionDate] = useState<string | null>(null);

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
      (observedEntries) => {
        const visible = observedEntries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible.length > 0) {
          const id = visible[0].target.id;
          const date = id.replace("entry-", "");
          setActiveDate(date);
        }
      },
      {
        root: null,
        rootMargin: "-10% 0px -70% 0px",
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
    <div className="flex min-h-0 h-full">
      {/* Left sidebar — navigation */}
      <div className="w-48 flex-shrink-0 border-r border-white/8 overflow-y-auto">
        <JournalSidebar
          dates={dates}
          activeDate={activeDate}
          onSelectDate={handleSelectDate}
        />
      </div>

      {/* Center — document content with margins like Google Docs */}
      <div
        ref={contentRef}
        className="flex-1 min-w-0 overflow-y-auto"
        style={{ maxHeight: "calc(100vh - 120px)" }}
      >
        <div className="max-w-2xl mx-auto px-8 py-6">
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
                <EntryRenderer
                  key={entry.id}
                  entry={entry}
                  suggestionOpen={suggestionDate === entry.date}
                  onToggleSuggestion={() =>
                    setSuggestionDate(
                      suggestionDate === entry.date ? null : entry.date
                    )
                  }
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Right margin — suggestion panel (Google Docs style) */}
      <div className="w-72 flex-shrink-0 border-l border-white/8 overflow-y-auto">
        {suggestionDate ? (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-400">
                Suggestion for {new Date(suggestionDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
              <button
                onClick={() => setSuggestionDate(null)}
                className="text-gray-500 hover:text-white text-xs"
              >
                Close
              </button>
            </div>
            <SuggestionPanel date={suggestionDate} />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-600 text-xs p-4 text-center">
            Click the ✎ icon on an entry to suggest a correction
          </div>
        )}
      </div>
    </div>
  );
}

/** Right-panel suggestion form */
function SuggestionPanel({ date }: { date: string }) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ correctedContent: string; extractedFacts: string[] } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    setIsLoading(true);
    try {
      const { submitSuggestion } = await import("@/lib/journal-api");
      const response = await submitSuggestion(date, input.trim());
      setResult(response);
    } catch (error) {
      console.error("Suggestion failed:", error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='e.g., "I wasn&#39;t at a restaurant, I was going to work."'
          className="w-full bg-white/5 border border-white/10 rounded-md p-2 text-sm text-gray-200 placeholder:text-gray-600 resize-none focus:outline-none focus:border-blue-500"
          rows={4}
          disabled={isLoading}
          autoFocus
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="mt-2 w-full px-3 py-1.5 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Processing..." : "Submit"}
        </button>
      </form>

      {result && (
        <div className="mt-4 border-t border-white/10 pt-3">
          <p className="text-xs text-green-400 mb-2">Entry corrected</p>
          {result.extractedFacts.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Learned facts:</p>
              <ul className="text-xs text-gray-500 list-disc list-inside">
                {result.extractedFacts.map((fact, i) => (
                  <li key={i}>{fact}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
