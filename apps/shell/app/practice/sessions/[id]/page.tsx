"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AuthGate } from "@/components/auth-gate";
import {
  getSession,
  getSettings,
  getVocabSession,
  type Session,
  type SessionItem,
  type VocabCard,
} from "@/lib/api/practice";
import { PracticeRunner } from "@/components/practice/runner";
import { VocabRunner } from "@/components/practice/vocab-runner";
import { InlineErrorState } from "@/components/inline-error-state";

type Loaded =
  | { kind: "workout"; session: Session; items: SessionItem[]; setsPerStrike: number }
  | { kind: "vocab"; session: Session; cards: VocabCard[] };

function RunnerContent({ sessionId }: { sessionId: string }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setLoaded(null);
    getSession(sessionId)
      .then(async (s) => {
        if (s.session.mode === "vocab") {
          const v = await getVocabSession(sessionId);
          setLoaded({ kind: "vocab", session: v.session, cards: v.cards });
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
  if (!loaded) return <div className="p-6 text-sm text-gray-400">Loading session…</div>;

  if (loaded.kind === "vocab") {
    return <VocabRunner session={loaded.session} cards={loaded.cards} />;
  }
  return <PracticeRunner session={loaded.session} items={loaded.items} setsPerStrike={loaded.setsPerStrike} />;
}

export default function SessionRunnerPage() {
  const params = useParams<{ id: string }>();
  return (
    <AuthGate>
      <RunnerContent sessionId={params.id} />
    </AuthGate>
  );
}
