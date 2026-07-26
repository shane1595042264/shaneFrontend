"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gradeVocab, completeSession, type Session, type VocabCard } from "@/lib/api/practice";

export function VocabRunner({ session, cards }: { session: Session; cards: VocabCard[] }) {
  const [queue, setQueue] = useState<VocabCard[]>(cards);
  const [pos, setPos] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const busy = useRef(false);
  const current = pos < queue.length ? queue[pos] : null;

  const finish = useCallback(() => {
    if (done) return;
    setDone(true);
    completeSession(session.id).catch(() => {});
    // Full navigation so the done page re-fetches the summary cleanly.
    window.location.assign(`/practice/sessions/${session.id}/done`);
  }, [done, session.id]);

  const grade = useCallback(
    async (g: "remember" | "forget") => {
      if (!current || busy.current) return;
      busy.current = true;
      const card = current;
      try {
        const res = await gradeVocab(session.id, card.itemId, g);
        if (res.longTermMemorized) setToast(`★ ${card.word} — long-term memorized!`);
        else if (res.memorized) setToast(`✓ ${card.word} — memorized at ${session.locationName ?? "here"}`);
        else setToast(null);
        // On a miss, requeue the card near the end for reinforcement (no further server write).
        if (g === "forget") setQueue((q) => [...q, { ...card, level: res.level }]);
      } catch {
        /* grade is best-effort; keep the session moving */
      } finally {
        busy.current = false;
        setRevealed(false);
        setPos((p) => p + 1);
      }
    },
    [current, session.id, session.locationName],
  );

  // Keyboard: Space/Enter reveal; after reveal ←/J/1 forget, →/K/2/Space/Enter remember; Esc end.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { finish(); return; }
      if (!current) return;
      if (!revealed) {
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); setRevealed(true); }
        return;
      }
      if (["ArrowLeft", "j", "J", "1"].includes(e.key)) { e.preventDefault(); void grade("forget"); }
      else if (["ArrowRight", "k", "K", "2", " ", "Enter"].includes(e.key)) { e.preventDefault(); void grade("remember"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, revealed, grade, finish]);

  // When the queue is exhausted, wrap up.
  useEffect(() => {
    if (!done && pos >= queue.length && queue.length > 0) finish();
  }, [pos, queue.length, done, finish]);

  if (!current) {
    return <div className="mx-auto max-w-md py-12 text-center text-sm text-gray-400">Finishing session…</div>;
  }

  const cap = 3;
  const dots = "●".repeat(Math.min(cap, current.level)) + "○".repeat(Math.max(0, cap - current.level));

  return (
    <div className="flex min-h-dvh flex-col bg-black text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-sm">
        <button type="button" onClick={finish} className="text-gray-400 hover:text-white">✕ End</button>
        <span className="text-gray-400">
          {session.locationName} · card {pos + 1} / {queue.length}
        </span>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <h2 className="text-4xl font-semibold">{current.word}</h2>
        <p className="mt-3 text-xs tracking-widest text-gray-500">
          Lv {dots} at {session.locationName}
        </p>

        {!revealed ? (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="mt-10 rounded bg-white px-6 py-3 text-lg font-medium text-black hover:bg-gray-200"
          >
            Reveal <span className="ml-2 text-xs text-gray-500">Space</span>
          </button>
        ) : (
          <>
            <div className="mt-6 max-w-md space-y-1">
              {(current.partOfSpeech || current.pronunciation) && (
                <p className="text-sm text-gray-400">
                  {current.partOfSpeech}
                  {current.partOfSpeech && current.pronunciation ? " · " : ""}
                  {current.pronunciation}
                </p>
              )}
              {current.definition && <p className="text-lg">{current.definition}</p>}
              {current.exampleSentence && (
                <p className="mt-2 text-sm italic text-gray-400">&ldquo;{current.exampleSentence}&rdquo;</p>
              )}
            </div>
            <div className="mt-10 flex gap-3">
              <button
                type="button"
                onClick={() => void grade("forget")}
                className="rounded border border-white/20 px-6 py-3 text-lg hover:bg-white/5"
              >
                ← Don&apos;t remember
              </button>
              <button
                type="button"
                onClick={() => void grade("remember")}
                className="rounded bg-white px-6 py-3 text-lg font-medium text-black hover:bg-gray-200"
              >
                Remember →
              </button>
            </div>
          </>
        )}

        {toast && (
          <p role="status" aria-live="polite" className="mt-8 text-sm text-emerald-400">
            {toast}
          </p>
        )}
      </main>

      <footer className="border-t border-white/10 px-4 py-2 text-center text-[11px] text-gray-600">
        Space reveal · ← / J don&apos;t remember · → / K remember · Esc end
      </footer>
    </div>
  );
}
