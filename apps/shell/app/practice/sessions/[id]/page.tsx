"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AuthGate } from "@/components/auth-gate";
import { getSession, getSettings, type Session, type SessionItem } from "@/lib/api/practice";
import { PracticeRunner } from "@/components/practice/runner";
import { InlineErrorState } from "@/components/inline-error-state";

function RunnerContent({ sessionId }: { sessionId: string }) {
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
  if (!session || !items) return <div className="p-6 text-sm text-gray-400">Loading session…</div>;

  return <PracticeRunner session={session} items={items} setsPerStrike={setsPerStrike} />;
}

export default function SessionRunnerPage() {
  const params = useParams<{ id: string }>();
  return (
    <AuthGate>
      <RunnerContent sessionId={params.id} />
    </AuthGate>
  );
}
