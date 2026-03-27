"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { DiaryEntry, NormalizedActivity } from "@shane/types";
import { fetchEntry, fetchActivities } from "@/lib/journal-api";
import { ActivityBreakdown } from "@/components/journal/activity-breakdown";
import { SuggestionChat } from "@/components/journal/suggestion-chat";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function EntryPage() {
  const params = useParams();
  const date = params.date as string;

  const [entry, setEntry] = useState<DiaryEntry | null>(null);
  const [activities, setActivities] = useState<NormalizedActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!date) return;

    async function load() {
      try {
        const [entryData, activitiesData] = await Promise.all([
          fetchEntry(date),
          fetchActivities(date).catch(() => []),
        ]);
        setEntry(entryData);
        setActivities(activitiesData);
      } catch {
        setError("Entry not found.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [date]);

  if (loading) {
    return (
      <div className="text-gray-400 text-sm animate-pulse">Loading entry...</div>
    );
  }

  if (error || !entry) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 mb-4">{error || "Entry not found."}</p>
        <Link
          href="/journal"
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          ← Back to timeline
        </Link>
      </div>
    );
  }

  const paragraphs = entry.content.split("\n").filter((p) => p.trim().length > 0);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/journal"
          className="text-sm text-gray-400 hover:text-white transition-colors mb-4 inline-block"
        >
          ← Back to timeline
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{formatDate(entry.date)}</h1>
        <p className="text-xs text-gray-500 mt-1">
          Voice profile v{entry.voiceProfileVersion}
        </p>
      </div>

      <article className="prose prose-invert max-w-none space-y-4">
        {paragraphs.map((paragraph, i) => (
          <p key={i} className="text-gray-200 leading-relaxed">
            {paragraph}
          </p>
        ))}
      </article>

      {activities.length > 0 && (
        <ActivityBreakdown activities={activities} />
      )}

      <SuggestionChat
        date={entry.date}
        onCorrected={(correctedContent) => {
          setEntry((prev) => prev ? { ...prev, content: correctedContent } : prev);
        }}
      />
    </div>
  );
}
