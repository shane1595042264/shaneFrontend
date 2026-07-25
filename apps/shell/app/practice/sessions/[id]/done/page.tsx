"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AuthGate } from "@/components/auth-gate";
import {
  getSession,
  getSettings,
  getVocabSummary,
  type Session,
  type SessionItem,
  type VocabSummary,
} from "@/lib/api/practice";
import { InlineErrorState } from "@/components/inline-error-state";

type Loaded =
  | { kind: "workout"; session: Session; items: SessionItem[]; setsPerStrike: number }
  | { kind: "vocab"; session: Session; summary: VocabSummary };

function DoneContent({ sessionId }: { sessionId: string }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setLoaded(null);
    getSession(sessionId)
      .then(async (s) => {
        if (s.session.mode === "vocab") {
          const summary = await getVocabSummary(sessionId);
          setLoaded({ kind: "vocab", session: s.session, summary });
        } else {
          const settings = await getSettings();
          setLoaded({ kind: "workout", session: s.session, items: s.items, setsPerStrike: settings.setsPerStrike });
        }
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
  if (!loaded) return <div className="p-6 text-sm text-gray-400">Loading summary…</div>;

  const footer = (
    <div className="mt-8 flex flex-wrap gap-3">
      <Link href="/practice" className="rounded bg-white px-4 py-2 text-sm text-black hover:bg-gray-200">Back to Practice</Link>
      <Link href="/practice/new" className="rounded border border-white/20 px-4 py-2 text-sm hover:bg-white/5">New session</Link>
      <Link href="/practice/history" className="rounded border border-white/20 px-4 py-2 text-sm hover:bg-white/5">View history</Link>
    </div>
  );

  if (loaded.kind === "vocab") {
    const { summary, session } = loaded;
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-semibold">Session complete</h1>
        <p className="mt-2 text-sm text-gray-400">
          {summary.reviewed} reviewed · <span className="text-emerald-400">{summary.remembered} remembered</span> ·{" "}
          {summary.forgot} forgot · {summary.leveledUp} leveled up
          {session.locationName ? <span className="ml-1">· at {session.locationName}</span> : null}
        </p>

        {summary.newlyMemorized.length > 0 ? (
          <div className="mt-6">
            <h2 className="mb-2 text-sm font-medium text-gray-400">
              ✓ Newly memorized{session.locationName ? ` at ${session.locationName}` : ""}
            </h2>
            <ul className="space-y-2">
              {summary.newlyMemorized.map((w) => (
                <li key={w.word} className="rounded border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                  <span className="text-emerald-400">✓</span> {w.word}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-6 text-sm text-gray-500">Keep going — no words hit level 3 this round.</p>
        )}

        {footer}
      </div>
    );
  }

  const { items, setsPerStrike } = loaded;
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

      {footer}
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
