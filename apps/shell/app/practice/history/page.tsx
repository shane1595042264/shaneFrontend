"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthGate } from "@/components/auth-gate";
import { listMySessions, type Session } from "@/lib/api/practice";

function HistoryContent() {
  const [sessions, setSessions] = useState<Session[] | null>(null);

  useEffect(() => {
    listMySessions().then(setSessions).catch(() => setSessions([]));
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/practice" className="text-sm text-gray-500 hover:text-gray-300">← back</Link>
      <h1 className="mt-3 mb-6 text-2xl font-semibold">Session history</h1>
      {sessions === null ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-gray-500">No sessions yet.</p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link href={`/practice/sessions/${s.id}/done`} className="block rounded border border-white/10 px-3 py-2 text-sm hover:bg-white/5">
                {new Date(s.startedAt).toLocaleString()} · {s.nItemsRequested} items
                {s.categoryFilter ? ` · ${s.categoryFilter}` : ""}
                {!s.completedAt && <span className="ml-2 text-yellow-400">(in progress)</span>}
              </Link>
            </li>
          ))}
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
