"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { DiaryEntry, NormalizedActivity } from "@shane/types";
import { EntryRenderer } from "@/components/journal/entry-renderer";
import { JournalSidebar } from "@/components/journal/journal-sidebar";
import { fetchEntry, submitSuggestion, regenerateEntry } from "@/lib/journal-api";

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

const SOURCE_LABELS: Record<string, string> = {
  github: "GitHub",
  strava: "Strava",
  google_maps: "Location",
  google_calendar: "Calendar",
  wechat: "WeChat",
  discord: "Discord",
  twitch: "Twitch",
};

const SOURCE_COLORS: Record<string, string> = {
  github: "text-purple-400",
  strava: "text-green-400",
  google_maps: "text-blue-400",
  google_calendar: "text-orange-400",
  wechat: "text-emerald-400",
  discord: "text-indigo-400",
  twitch: "text-violet-400",
};

export function JournalDocument({ entries }: JournalDocumentProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  const [activeDate, setActiveDate] = useState<string | null>(
    entries.length > 0 ? entries[0].date : null
  );

  // Activities for the active entry (fetched on demand)
  const [activeActivities, setActiveActivities] = useState<NormalizedActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [debugNotes, setDebugNotes] = useState<string[]>([]);

  // Suggestion state
  const [suggestionInput, setSuggestionInput] = useState("");
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [suggestionResult, setSuggestionResult] = useState<{ correctedContent: string; extractedFacts: string[] } | null>(null);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);

  // Entry content overrides (from regeneration or correction)
  const [contentOverrides, setContentOverrides] = useState<Record<string, string>>({});

  // Regeneration state
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Mobile responsive state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);

  // Fetch activities when active date changes
  useEffect(() => {
    if (!activeDate) return;
    setActiveActivities([]);
    setDebugNotes([]);
    setLoadingActivities(true);
    setSuggestionInput("");
    setSuggestionResult(null);
    setSuggestionError(null);

    fetchEntry(activeDate)
      .then((data) => {
        setActiveActivities(data.activities || []);
        setDebugNotes(data.debugNotes || []);
      })
      .catch(() => {
        setActiveActivities([]);
        setDebugNotes([]);
      })
      .finally(() => setLoadingActivities(false));
  }, [activeDate]);

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
      { root: null, rootMargin: "-10% 0px -70% 0px", threshold: 0 }
    );

    const articles = contentRef.current.querySelectorAll("article[id^='entry-']");
    articles.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [entries]);

  async function handleSuggestionSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeDate || !suggestionInput.trim() || suggestionLoading) return;
    setSuggestionLoading(true);
    setSuggestionError(null);
    try {
      const result = await submitSuggestion(activeDate, suggestionInput.trim());
      setSuggestionResult(result);
      setSuggestionInput("");
    } catch (err) {
      console.error("Suggestion failed:", err);
      setSuggestionError("Failed to submit suggestion. Please try again.");
      setTimeout(() => setSuggestionError(null), 5000);
    } finally {
      setSuggestionLoading(false);
    }
  }

  async function handleRegenerate() {
    if (!activeDate || regenerating) return;
    setRegenerating(true);
    setRegenerateError(null);
    try {
      const result = await regenerateEntry(activeDate);
      setContentOverrides((prev) => ({ ...prev, [activeDate]: result.content }));
    } catch (err) {
      setRegenerateError(err instanceof Error ? err.message : "Regeneration failed");
      setTimeout(() => setRegenerateError(null), 5000);
    } finally {
      setRegenerating(false);
    }
  }

  // Filter entries by search query (strip data markers for matching)
  const filteredEntries = searchQuery.trim()
    ? entries.filter((e) => {
        const plain = (contentOverrides[e.date] || e.content)
          .replace(/\[\[data:\w+\|/g, "")
          .replace(/\|{[^}]*}\]\]/g, "")
          .replace(/\]\]/g, "");
        return plain.toLowerCase().includes(searchQuery.trim().toLowerCase());
      })
    : entries;

  const dates = filteredEntries.map((e) => e.date);

  if (entries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center py-32">
        <div className="text-center">
          <p className="text-gray-500 text-sm">No journal entries yet.</p>
          <p className="text-gray-600 text-xs mt-1">Entries will appear here once generated.</p>
        </div>
      </div>
    );
  }

  const yearGroups = groupByYear(filteredEntries);
  const years = Object.keys(yearGroups).map(Number).sort((a, b) => b - a);

  // Group activities by source for the right panel
  const activitiesBySource: Record<string, NormalizedActivity[]> = {};
  for (const a of activeActivities) {
    const src = a.source || "unknown";
    if (!activitiesBySource[src]) activitiesBySource[src] = [];
    activitiesBySource[src].push(a);
  }

  const activeDateFormatted = activeDate
    ? new Date(activeDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    : "";

  const activityPanelContent = activeDate ? (
    <div className="p-3">
      {/* Date label */}
      <div className="text-gray-400 font-medium mb-3 pb-2 border-b border-white/8">
        {activeDateFormatted}
      </div>

      {/* Activity feed */}
      {loadingActivities ? (
        <div className="space-y-2 py-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-4 w-16 rounded bg-white/8 animate-pulse" />
              <div className="h-3 w-full rounded bg-white/8 animate-pulse" />
              <div className="h-3 w-3/4 rounded bg-white/8 animate-pulse" />
            </div>
          ))}
        </div>
      ) : activeActivities.length === 0 ? (
        <div className="text-gray-600 py-4 text-center">No activity data</div>
      ) : (
        <div className="space-y-3 mb-4">
          {Object.entries(activitiesBySource).map(([source, acts]) => (
            <ActivitySourceGroup key={source} source={source} activities={acts} />
          ))}
        </div>
      )}

      {/* Debug notes (only shown when issues exist) */}
      {debugNotes.length > 0 && (
        <DebugNotesSection notes={debugNotes} />
      )}

      {/* Regenerate button for short entries */}
      {(() => {
        const activeEntry = entries.find((e) => e.date === activeDate);
        const content = activeEntry ? (contentOverrides[activeEntry.date] || activeEntry.content) : "";
        const wordCount = content.split(/\s+/).filter(Boolean).length;
        if (wordCount >= 100) return null;
        return (
          <div className="border-t border-white/8 pt-3 mt-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-medium text-amber-400/80">Short entry</span>
              <span className="text-gray-600">{wordCount} words</span>
            </div>
            <p className="text-gray-500 mb-2">
              This entry is shorter than usual. Regenerate with Claude for a richer version.
            </p>
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="w-full px-2 py-1.5 bg-amber-600/80 text-white text-xs rounded hover:bg-amber-500/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {regenerating ? "Regenerating..." : "Regenerate entry"}
            </button>
            {regenerateError && (
              <div className="mt-1.5 text-red-400 text-xs">{regenerateError}</div>
            )}
          </div>
        );
      })()}

      {/* Divider */}
      <div className="border-t border-white/8 pt-3 mt-3">
        <div className="text-gray-400 font-medium mb-2">Suggest a correction</div>
        <form onSubmit={handleSuggestionSubmit}>
          <textarea
            value={suggestionInput}
            onChange={(e) => setSuggestionInput(e.target.value)}
            placeholder="e.g., &quot;I wasn't at a restaurant, I was at work.&quot;"
            className="w-full bg-white/5 border border-white/10 rounded p-2 text-xs text-gray-200 placeholder:text-gray-600 resize-none focus:outline-none focus:border-blue-500"
            rows={3}
            disabled={suggestionLoading}
          />
          <button
            type="submit"
            disabled={suggestionLoading || !suggestionInput.trim()}
            className="mt-1.5 w-full px-2 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {suggestionLoading ? "Processing..." : "Submit"}
          </button>
        </form>

        {suggestionError && (
          <div className="mt-2 text-red-400 text-xs">{suggestionError}</div>
        )}

        {suggestionResult && (
          <div className="mt-3 border-t border-white/10 pt-2">
            <p className="text-green-400 mb-1">Entry corrected</p>
            {suggestionResult.extractedFacts.length > 0 && (
              <div>
                <p className="text-gray-400 mb-1">Learned:</p>
                <ul className="text-gray-500 list-disc list-inside">
                  {suggestionResult.extractedFacts.map((fact, i) => (
                    <li key={i}>{fact}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className="flex flex-col min-h-0 h-full">
      {/* Mobile toolbar — visible below lg */}
      <div className="flex lg:hidden items-center gap-2 pb-3 flex-shrink-0">
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-white/10 text-gray-400 hover:text-white hover:bg-white/8 transition-colors md:hidden"
        >
          <span className="text-sm">☰</span>
          <span>Dates</span>
        </button>
        <button
          onClick={() => setActivityOpen((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-white/10 text-gray-400 hover:text-white hover:bg-white/8 transition-colors"
        >
          <span className="text-sm">◧</span>
          <span>Activity</span>
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Mobile sidebar overlay — below md */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-56 bg-gray-950 border-r border-white/10 overflow-y-auto z-50">
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                <span className="text-xs font-medium text-gray-400">Navigate</span>
                <button onClick={() => setSidebarOpen(false)} className="text-gray-500 hover:text-white text-sm">✕</button>
              </div>
              <JournalSidebar dates={dates} activeDate={activeDate} onSelectDate={(date) => { handleSelectDate(date); setSidebarOpen(false); }} searchQuery={searchQuery} onSearchChange={setSearchQuery} totalCount={entries.length} />
            </div>
          </div>
        )}

        {/* Left sidebar — hidden on mobile, visible from md up */}
        <div className="hidden md:block w-44 flex-shrink-0 border-r border-white/8 overflow-y-auto">
          <JournalSidebar dates={dates} activeDate={activeDate} onSelectDate={handleSelectDate} searchQuery={searchQuery} onSearchChange={setSearchQuery} totalCount={entries.length} />
        </div>

        {/* Center — document */}
        <div
          ref={contentRef}
          className="flex-1 min-w-0 overflow-y-auto"
          style={{ maxHeight: "calc(100vh - 120px)" }}
        >
          <div className="max-w-2xl mx-auto px-4 md:px-8 py-6">
            {years.map((year) => (
              <div key={year}>
                <div className="flex items-center gap-3 mb-8 mt-2">
                  <span className="text-2xl font-bold text-white/20 tracking-widest select-none">{year}</span>
                  <div className="flex-1 h-px bg-white/8" />
                </div>
                {yearGroups[year].map((entry) => (
                  <EntryRenderer
                    key={entry.date}
                    entry={contentOverrides[entry.date]
                      ? { ...entry, content: contentOverrides[entry.date] }
                      : entry}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Right panel — desktop: inline, below lg: overlay */}
        <div className="hidden lg:block w-72 flex-shrink-0 border-l border-white/8 overflow-y-auto text-xs" style={{ maxHeight: "calc(100vh - 120px)" }}>
          {activityPanelContent}
        </div>

        {/* Activity overlay — below lg */}
        {activityOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setActivityOpen(false)} />
            <div className="absolute right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-gray-950 border-l border-white/10 overflow-y-auto z-50 text-xs">
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                <span className="text-xs font-medium text-gray-400">Activity & Suggestions</span>
                <button onClick={() => setActivityOpen(false)} className="text-gray-500 hover:text-white text-sm">✕</button>
              </div>
              {activityPanelContent}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Collapsible source group in the right panel */
function ActivitySourceGroup({ source, activities }: { source: string; activities: NormalizedActivity[] }) {
  const [expanded, setExpanded] = useState(false);
  const label = SOURCE_LABELS[source] || source;
  const color = SOURCE_COLORS[source] || "text-gray-400";

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left hover:bg-white/5 rounded px-1.5 py-1 -mx-1.5 transition-colors"
      >
        <span className={`font-medium ${color}`}>{label}</span>
        <span className="text-gray-600">
          {activities.length} {expanded ? "▴" : "▾"}
        </span>
      </button>

      {expanded && (
        <div className="mt-1 space-y-1 pl-1">
          {activities.slice(0, 20).map((a, i) => (
            <div key={i} className="bg-white/5 rounded px-2 py-1.5">
              <div className="text-gray-500 font-mono mb-0.5">{a.type}</div>
              <div className="text-gray-400 break-all whitespace-pre-wrap">
                {formatActivityData(a)}
              </div>
            </div>
          ))}
          {activities.length > 20 && (
            <div className="text-gray-600 text-center py-1">+{activities.length - 20} more</div>
          )}
        </div>
      )}
    </div>
  );
}

/** Collapsible debug notes section for data quality issues */
function DebugNotesSection({ notes }: { notes: string[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-t border-white/8 pt-3 mt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left hover:bg-white/5 rounded px-1.5 py-1 -mx-1.5 transition-colors"
      >
        <span className="font-medium text-yellow-500/70">Debug notes</span>
        <span className="text-gray-600">
          {notes.length} {expanded ? "▴" : "▾"}
        </span>
      </button>

      {expanded && (
        <div className="mt-1 space-y-1 pl-1">
          {notes.map((note, i) => (
            <div key={i} className="bg-yellow-500/5 border border-yellow-500/10 rounded px-2 py-1.5">
              <div className="text-gray-400">{note}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Format activity data into a readable one-liner instead of raw JSON */
function formatActivityData(a: NormalizedActivity): string {
  const d = a.data as Record<string, unknown>;

  if (a.source === "github" && a.type === "commit") {
    return `${d.repo}: "${d.message}"`;
  }
  if (a.source === "strava") {
    const km = d.distanceMeters ? ((d.distanceMeters as number) / 1000).toFixed(1) + "km" : "";
    return `${d.name || a.type} ${km}`.trim();
  }
  if (a.source === "google_maps" && d.name) {
    return `${d.name}${d.durationMinutes ? ` (${d.durationMinutes}min)` : ""}`;
  }
  if (a.source === "google_calendar") {
    return `${d.title || "Event"}${d.startTime ? ` at ${new Date(d.startTime as string).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : ""}`;
  }
  if (a.source === "wechat") {
    const sender = d.sender === "self" ? "You" : (d.sender as string) || "Unknown";
    return `${sender} in ${d.chat || "chat"}: ${((d.content as string) || "").slice(0, 80)}`;
  }
  if (a.source === "discord") {
    return `${((d.content as string) || "").slice(0, 80)}${d.hasAttachments ? ` (+${d.attachmentCount} file${(d.attachmentCount as number) > 1 ? "s" : ""})` : ""}`;
  }
  if (a.source === "twitch") {
    const mins = d.durationSeconds ? Math.round((d.durationSeconds as number) / 60) : 0;
    return `${d.title || "Stream"}${mins ? ` (${mins}min)` : ""}${d.viewCount ? ` — ${d.viewCount} views` : ""}`;
  }
  if (a.type === "location_ping") {
    const t = d.timestamp ? new Date(d.timestamp as string).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
    return `${(d.latitude as number)?.toFixed(4)}, ${(d.longitude as number)?.toFixed(4)} ${t}`;
  }

  // Fallback: compact JSON
  return JSON.stringify(d).slice(0, 100);
}
