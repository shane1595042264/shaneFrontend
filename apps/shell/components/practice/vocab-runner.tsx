"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gradeVocab, completeSession, type Session, type VocabCard } from "@/lib/api/practice";

export function VocabRunner({ session, cards }: { session: Session; cards: VocabCard[] }) {
  const [queue, setQueue] = useState<VocabCard[]>(cards);
  const [pos, setPos] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [gradeError, setGradeError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const busy = useRef(false);
  const finishingRef = useRef(false);
  const gradeInFlight = useRef<Promise<unknown> | null>(null);
  const current = pos < queue.length ? queue[pos] : null;

  // Awaited, not fired and forgotten: the full navigation below aborts any
  // fetch still in flight, so completing the session (and a grade that was
  // still saving) used to be cut off and the session left open. On failure
  // the runner stays put with the error and End / Retry tries again;
  // completing a session twice only restamps its end time.
  const finish = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setFinishing(true);
    setFinishError(null);
    try {
      await gradeInFlight.current?.catch(() => {});
      await completeSession(session.id);
      // Full navigation so the done page re-fetches the summary cleanly.
      window.location.assign(`/practice/sessions/${session.id}/done`);
    } catch (e) {
      setFinishError((e as Error).message || "Failed to end the session");
      finishingRef.current = false;
      setFinishing(false);
    }
  }, [session.id]);

  // A failed grade keeps the card revealed with the error, so pressing the
  // same answer re-sends it. Moving on would skip a card the SRS never saw.
  const grade = useCallback(
    async (g: "remember" | "forget") => {
      if (!current || busy.current || finishingRef.current) return;
      busy.current = true;
      setGradeError(null);
      const card = current;
      const request = gradeVocab(session.id, card.itemId, g);
      gradeInFlight.current = request;
      try {
        const res = await request;
        if (res.longTermMemorized) setToast(`★ ${card.word} — long-term memorized!`);
        else if (res.memorized) setToast(`✓ ${card.word} — memorized at ${session.locationName ?? "here"}`);
        else setToast(null);
        // On a miss, requeue the card near the end for reinforcement (no further server write).
        if (g === "forget") setQueue((q) => [...q, { ...card, level: res.level }]);
        setRevealed(false);
        setPos((p) => p + 1);
      } catch (e) {
        setToast(null);
        setGradeError((e as Error).message || "Failed to save");
      } finally {
        busy.current = false;
        gradeInFlight.current = null;
      }
    },
    [current, session.id, session.locationName],
  );

  // Keyboard: Space/Enter reveal; after reveal ←/J/1 forget, →/K/2/Space/Enter remember; Esc end.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { void finish(); return; }
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

  // When the queue is exhausted, wrap up. A failed finish is retried from the
  // button below, not by this effect.
  useEffect(() => {
    if (pos >= queue.length && queue.length > 0) void finish();
  }, [pos, queue.length, finish]);

  if (!current) {
    return (
      <div className="mx-auto max-w-md py-12 text-center text-sm text-gray-400">
        {finishError ? (
          <>
            <p role="alert" className="text-red-400">Could not end the session: {finishError}</p>
            <button
              type="button"
              onClick={() => void finish()}
              className="mt-4 rounded border border-white/20 px-4 py-2 text-white hover:bg-white/5"
            >
              Retry
            </button>
          </>
        ) : (
          "Finishing session…"
        )}
      </div>
    );
  }

  const cap = 3;
  const dots = "●".repeat(Math.min(cap, current.level)) + "○".repeat(Math.max(0, cap - current.level));

  return (
    <div className="flex min-h-dvh flex-col bg-black text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-sm">
        <button
          type="button"
          onClick={() => void finish()}
          disabled={finishing}
          className="text-gray-400 hover:text-white disabled:opacity-50"
        >
          {finishing ? "Ending…" : "✕ End"}
        </button>
        <span className="text-gray-400">
          {session.locationName} · card {pos + 1} / {queue.length}
        </span>
      </header>
      {finishError && (
        <p role="alert" className="border-b border-white/10 px-4 py-2 text-sm text-red-400">
          Could not end the session: {finishError}
        </p>
      )}

      <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <h2 className="text-4xl font-semibold">{current.word}</h2>
        <p className="mt-3 text-xs tracking-widest text-gray-400">
          Lv {dots} at {session.locationName}
        </p>

        {!revealed ? (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="mt-10 rounded bg-white px-6 py-3 text-lg font-medium text-black hover:bg-gray-200"
          >
            Reveal <span className="ml-2 text-xs text-gray-400">Space</span>
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

        {gradeError && (
          <p role="alert" className="mt-8 text-sm text-red-400">
            Could not save your answer: {gradeError}. Pick it again to retry.
          </p>
        )}

        {toast && (
          <p role="status" aria-live="polite" className="mt-8 text-sm text-emerald-400">
            {toast}
          </p>
        )}
      </div>

      <footer className="border-t border-white/10 px-4 py-2 text-center text-[11px] text-gray-400">
        Space reveal · ← / J don&apos;t remember · → / K remember · Esc end
      </footer>
    </div>
  );
}
