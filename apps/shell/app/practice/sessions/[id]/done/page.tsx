"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AuthGate } from "@/components/auth-gate";
import { getSession, getSettings, type Session, type SessionItem } from "@/lib/api/practice";
import { InlineErrorState } from "@/components/inline-error-state";

function DoneContent({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [items, setItems] = useState<SessionItem[] | null>(null);
  const [setsPerStrike, setSetsPerStrike] = useState(5);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setSession(null);
    setItems(null);
    Promise.all([getSession(sessionId), getSettings()])
      .then(([s, settings]) => {
        setSession(s.session);
        setItems(s.items);
        setSetsPerStrike(settings.setsPerStrike);
      })
      .catch((e) => setError(e.message ?? "Failed"));
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error)
    return (
      <InlineErrorState message={error} onRetry={load} backHref="/practice" backLabel="Back to practice" />
    );
  if (!session || !items) return <div className="p-6 text-sm text-gray-400">Loading summary…</div>;

  const strikesEarned = items.filter((it) => it.setsCompleted >= setsPerStrike).length;
  const totalSets = items.reduce((sum, it) => sum + it.setsCompleted, 0);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Session complete</h1>
      <p className="mt-2 text-sm text-gray-400">
        {items.length} items · {strikesEarned} strikes earned · {totalSets} sets total
      </p>

      <ul className="mt-6 space-y-2">
        {items.map((it) => {
          const earned = it.setsCompleted >= setsPerStrike;
          return (
            <li key={it.id} className="flex items-center justify-between rounded border border-white/10 p-3 text-sm">
              <span>
                <span className={earned ? "text-emerald-400" : "text-gray-400"}>{earned ? "✓" : "—"}</span>{" "}
                {it.word} · {it.setsCompleted}/{setsPerStrike} sets
                {it.locationName ? <span className="ml-2 text-xs text-gray-500">@ {it.locationName}</span> : null}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/practice" className="rounded bg-white px-4 py-2 text-sm text-black hover:bg-gray-200">Back to Practice</Link>
        <Link href="/practice/new" className="rounded border border-white/20 px-4 py-2 text-sm hover:bg-white/5">New session</Link>
        <Link href="/practice/history" className="rounded border border-white/20 px-4 py-2 text-sm hover:bg-white/5">View history</Link>
      </div>
    </div>
  );
}

export default function SessionDonePage() {
  const params = useParams<{ id: string }>();
  return (
    <AuthGate>
      <DoneContent sessionId={params.id} />
    </AuthGate>
  );
}
