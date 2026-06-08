"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthGate } from "@/components/auth-gate";
import { listMySessions, type Session } from "@/lib/api/practice";
import { RelativeTime } from "@/lib/format-time";

function formatSessionDuration(startedAt: string, completedAt: string): string {
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function HistoryContent() {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMySessions()
      .then(setSessions)
      .catch((e) => setError(e.message ?? "Failed to load"));
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/practice" className="text-sm text-gray-500 hover:text-gray-300">← back</Link>
      <h1 className="mt-3 mb-6 text-2xl font-semibold">Session history</h1>
      {error && <p role="alert" className="mb-4 text-sm text-red-400">{error}</p>}
      {sessions === null ? (
        error ? null : <p className="text-sm text-gray-400">Loading…</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-gray-500">No sessions yet.</p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => {
            const inProgress = !s.completedAt;
            const href = inProgress ? `/practice/sessions/${s.id}` : `/practice/sessions/${s.id}/done`;
            const duration = s.completedAt ? formatSessionDuration(s.startedAt, s.completedAt) : null;
            return (
              <li key={s.id}>
                <Link href={href} className="block rounded border border-white/10 px-3 py-2 text-sm hover:bg-white/5">
                  <RelativeTime iso={s.startedAt} className="text-gray-300" /> · {s.nItemsRequested} items
                  {duration && ` · ${duration}`}
                  {s.categoryFilter ? ` · ${s.categoryFilter}` : ""}
                  {inProgress && <span className="ml-2 text-yellow-400">(resume →)</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function HistoryPage() {
  return (
    <AuthGate>
      <HistoryContent />
    </AuthGate>
  );
}
