"use client";

import { useState } from "react";
import type { NormalizedActivity } from "@shane/types";

interface ActivityBreakdownProps {
  activities: NormalizedActivity[];
}

const SOURCE_LABELS: Record<string, string> = {
  github: "GitHub",
  youtube: "YouTube",
  steam: "Steam",
  manual: "Manual",
};

const SOURCE_ICONS: Record<string, string> = {
  github: "⌨",
  youtube: "▶",
  steam: "🎮",
  manual: "✏",
};

function groupBySource(
  activities: NormalizedActivity[]
): Record<string, NormalizedActivity[]> {
  return activities.reduce<Record<string, NormalizedActivity[]>>((acc, activity) => {
    const source = activity.source || "unknown";
    if (!acc[source]) acc[source] = [];
    acc[source].push(activity);
    return acc;
  }, {});
}

export function ActivityBreakdown({ activities }: ActivityBreakdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const grouped = groupBySource(activities);
  const sources = Object.keys(grouped);

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition-colors"
      >
        <span className="text-sm font-medium text-gray-300">
          Activity breakdown{" "}
          <span className="text-gray-500 font-normal">
            ({activities.length} {activities.length === 1 ? "event" : "events"})
          </span>
        </span>
        <span className="text-gray-500 text-xs">{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <div className="border-t border-white/10 divide-y divide-white/5">
          {sources.map((source) => (
            <div key={source} className="px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base" aria-hidden>
                  {SOURCE_ICONS[source] ?? "📌"}
                </span>
                <h3 className="text-sm font-semibold text-gray-200">
                  {SOURCE_LABELS[source] ?? source}
                </h3>
                <span className="text-xs text-gray-500 ml-auto">
                  {grouped[source].length} {grouped[source].length === 1 ? "event" : "events"}
                </span>
              </div>
              <div className="space-y-2">
                {grouped[source].map((activity) => (
                  <div
                    key={activity.id}
                    className="bg-white/5 rounded-lg px-3 py-2"
                  >
                    <div className="text-xs text-gray-400 mb-1 font-mono">
                      {activity.type}
                    </div>
                    <pre className="text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap break-all">
                      {JSON.stringify(activity.data, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
