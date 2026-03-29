"use client";

import { useEffect, useState, useCallback } from "react";
import type { DiaryEntry } from "@shane/types";
import { fetchEntries } from "@/lib/journal-api";
import { JournalDocument } from "@/components/journal/journal-document";

const MAX_ENTRIES = 500;

export default function JournalPage() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEntries({ limit: MAX_ENTRIES });
      setEntries(data.entries);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load journal entries"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  if (loading) {
    return <JournalSkeleton />;
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center py-32">
        <div className="text-center space-y-3">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={loadEntries}
            className="px-4 py-2 text-xs bg-white/10 hover:bg-white/15 text-gray-200 rounded transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return <JournalDocument entries={entries} />;
}

/** Skeleton shown while journal entries are loading */
function JournalSkeleton() {
  return (
    <div className="flex min-h-0 h-full">
      {/* Sidebar skeleton */}
      <div className="hidden md:block w-44 flex-shrink-0 border-r border-white/8 p-2 space-y-2">
        <SkeletonBar className="h-5 w-16" />
        <div className="ml-2 space-y-1.5">
          <SkeletonBar className="h-4 w-20" />
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonBar key={i} className="h-3.5 w-10 ml-2" />
          ))}
        </div>
        <SkeletonBar className="h-4 w-20 ml-2" />
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBar key={i} className="h-3.5 w-10 ml-4" />
        ))}
      </div>

      {/* Content skeleton */}
      <div className="flex-1 min-w-0 px-4 md:px-8 py-6 max-w-2xl mx-auto space-y-8">
        <SkeletonBar className="h-7 w-20" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <SkeletonBar className="h-5 w-32" />
            <SkeletonBar className="h-3 w-full" />
            <SkeletonBar className="h-3 w-5/6" />
            <SkeletonBar className="h-3 w-4/6" />
            <SkeletonBar className="h-3 w-full" />
            <SkeletonBar className="h-3 w-3/4" />
          </div>
        ))}
      </div>

      {/* Right panel skeleton */}
      <div className="hidden lg:block w-72 flex-shrink-0 border-l border-white/8 p-3 space-y-3">
        <SkeletonBar className="h-4 w-24" />
        <div className="border-t border-white/8 pt-3 space-y-2">
          <SkeletonBar className="h-4 w-16" />
          <SkeletonBar className="h-3 w-full" />
          <SkeletonBar className="h-3 w-3/4" />
        </div>
      </div>
    </div>
  );
}

function SkeletonBar({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded bg-white/8 animate-pulse ${className}`}
    />
  );
}
