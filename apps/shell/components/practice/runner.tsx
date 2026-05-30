"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  syncSessionItem,
  beaconSync,
  completeSession,
  type SessionItem,
  type Session,
  type TimerState,
} from "@/lib/api/practice";
import { LocationPrompt } from "./location-prompt";

interface Props {
  session: Session;
  items: SessionItem[];
  setsPerStrike: number;
}

const DEFAULT_PRESCRIPTION = { setMode: "time" as const, setSize: 60, restSeconds: 30 };
function prescriptionOf(item: SessionItem) {
  return item.prescription ?? DEFAULT_PRESCRIPTION;
}

function formatMMSS(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

let audioCtx: AudioContext | null = null;
function playPing() {
  if (typeof window === "undefined") return;
  try {
    audioCtx = audioCtx ?? new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
  } catch {
    // autoplay restriction / no audio device — ignore
  }
}

export function PracticeRunner({ session, items, setsPerStrike }: Props) {
  const router = useRouter();
  const firstIncomplete = items.findIndex((it) => !it.completedAt);
  const [position, setPosition] = useState(() => (firstIncomplete === -1 ? items.length : firstIncomplete));
  const current = position >= items.length ? null : items[position];

  const [timer, setTimer] = useState<TimerState | null>(current?.timerState ?? null);
  const [setsCompleted, setSetsCompleted] = useState(current?.setsCompleted ?? 0);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeLockRef = useRef<{ release?: () => Promise<void> } | null>(null);

  const syncToServer = useCallback(
    (patch: { timerState?: TimerState | null; setsCompleted?: number; completedAt?: string | null; startedAt?: string | null; locationId?: string | null; locationName?: string | null }) => {
      if (!current) return;
      syncSessionItem(current.id, patch).catch(() => {});
    },
    [current],
  );

  // Wake Lock while running
  useEffect(() => {
    if (!current || timer?.status !== "running") {
      if (wakeLockRef.current) { wakeLockRef.current.release?.().catch(() => {}); wakeLockRef.current = null; }
      return;
    }
    const nav = navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release?: () => Promise<void> }> } };
    if (typeof navigator !== "undefined" && nav.wakeLock) {
      nav.wakeLock.request("screen").then((wl) => { wakeLockRef.current = wl; }).catch(() => {});
    }
    return () => { if (wakeLockRef.current) { wakeLockRef.current.release?.().catch(() => {}); wakeLockRef.current = null; } };
  }, [current, timer?.status]);

  function advancePhase(prev: TimerState): TimerState {
    if (!current) return prev;
    if (prev.phase === "work") {
      const newCount = setsCompleted + 1;
      setSetsCompleted(newCount);
      syncToServer({ setsCompleted: newCount });
      if (newCount >= setsPerStrike) {
        syncToServer({ timerState: null });
        setShowLocationPrompt(true);
        return { ...prev, status: "paused", elapsedSeconds: 0, phase: "work", lastSyncedAt: new Date().toISOString() };
      }
      const next: TimerState = { currentSet: prev.currentSet, phase: "rest", status: "running", elapsedSeconds: 0, lastSyncedAt: new Date().toISOString() };
      syncToServer({ timerState: next });
      return next;
    }
    const next: TimerState = { currentSet: prev.currentSet + 1, phase: "work", status: "running", elapsedSeconds: 0, lastSyncedAt: new Date().toISOString() };
    syncToServer({ timerState: next });
    return next;
  }

  // Local tick loop while running
  useEffect(() => {
    if (timer?.status !== "running" || !current) return;
    const presc = prescriptionOf(current);
    tickRef.current = setInterval(() => {
      setTimer((prev) => {
        if (!prev || prev.status !== "running") return prev;
        const phaseDuration = prev.phase === "work" ? presc.setSize : presc.restSeconds;
        if (prev.elapsedSeconds + 1 >= phaseDuration) {
          return advancePhase(prev);
        }
        return { ...prev, elapsedSeconds: prev.elapsedSeconds + 1 };
      });
    }, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer?.status, current]);

  // Heartbeat every 30s while running
  useEffect(() => {
    if (timer?.status !== "running") return;
    heartbeatRef.current = setInterval(() => {
      setTimer((t) => { if (t) syncToServer({ timerState: { ...t, lastSyncedAt: new Date().toISOString() } }); return t; });
    }, 30_000);
    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
  }, [timer?.status, syncToServer]);

  // Persist on pagehide + visibilitychange
  useEffect(() => {
    if (!current) return;
    const persist = () => {
      setTimer((t) => { if (t) beaconSync(current.id, { timerState: { ...t, lastSyncedAt: new Date().toISOString() } }); return t; });
    };
    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", persist);
    return () => { window.removeEventListener("pagehide", persist); document.removeEventListener("visibilitychange", persist); };
  }, [current]);

  // Audio ping on phase transition
  const lastPhaseRef = useRef<string | undefined>(timer?.phase);
  useEffect(() => {
    if (!timer) return;
    if (lastPhaseRef.current && lastPhaseRef.current !== timer.phase) playPing();
    lastPhaseRef.current = timer.phase;
  }, [timer?.phase]);

  const start = () => {
    const initial: TimerState = { currentSet: 1, phase: "work", status: "running", elapsedSeconds: 0, lastSyncedAt: new Date().toISOString() };
    setTimer(initial);
    syncToServer({ timerState: initial, startedAt: new Date().toISOString() });
  };

  const togglePause = () => {
    if (!timer) return;
    const next: TimerState = { ...timer, status: timer.status === "running" ? "paused" : "running", lastSyncedAt: new Date().toISOString() };
    setTimer(next);
    syncToServer({ timerState: next });
  };

  const skipSet = () => { if (timer) setTimer(advancePhase({ ...timer, phase: "work" })); };
  const skipItem = () => { syncToServer({ completedAt: new Date().toISOString(), timerState: null }); setShowLocationPrompt(true); };

  const onLocationPicked = (loc: { id: string; name: string } | null) => {
    if (!current) return;
    syncSessionItem(current.id, {
      completedAt: new Date().toISOString(),
      timerState: null,
      ...(loc ? { locationId: loc.id, locationName: loc.name } : {}),
    }).catch(() => {});
    setShowLocationPrompt(false);
    moveToNextItemOrDone();
  };

  const moveToNextItemOrDone = () => {
    const nextPos = position + 1;
    if (nextPos >= items.length) {
      completeSession(session.id).catch(() => {});
      router.push(`/practice/sessions/${session.id}/done`);
      return;
    }
    setPosition(nextPos);
    setSetsCompleted(items[nextPos].setsCompleted ?? 0);
    setTimer(items[nextPos].timerState ?? null);
    setShowLocationPrompt(false);
  };

  const abandonSession = () => {
    completeSession(session.id).catch(() => {});
    router.push(`/practice/sessions/${session.id}/done`);
  };

  if (!current) {
    return (
      <div className="mx-auto max-w-md py-12 text-center">
        <p className="text-sm">Session complete!</p>
        <Link href={`/practice/sessions/${session.id}/done`} className="mt-4 inline-block underline">View summary</Link>
      </div>
    );
  }

  const presc = prescriptionOf(current);
  const phaseDuration = timer?.phase === "rest" ? presc.restSeconds : presc.setSize;
  const remaining = Math.max(0, phaseDuration - (timer?.elapsedSeconds ?? 0));

  return (
    <div className="flex min-h-dvh flex-col bg-black text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-sm">
        <button type="button" onClick={abandonSession} className="text-gray-400 hover:text-white">← Abandon</button>
        <span className="text-gray-400">Item {position + 1} of {items.length}</span>
      </header>

      {showLocationPrompt ? (
        <div className="mx-auto w-full max-w-md flex-1 p-4">
          <LocationPrompt onPick={onLocationPicked} onSkip={() => onLocationPicked(null)} />
        </div>
      ) : (
        <main className="flex flex-1 flex-col items-center justify-center px-4 text-center">
          <h2 className="text-xl font-semibold">{current.word}</h2>
          <p className="mt-1 text-sm text-gray-400">
            Set {timer?.currentSet ?? "—"} / {setsPerStrike} · {setsCompleted} done
          </p>
          <div className={`my-8 font-mono text-8xl tabular-nums ${timer?.phase === "rest" ? "text-emerald-400" : "text-blue-400"}`}>
            {timer === null ? formatMMSS(phaseDuration) : formatMMSS(remaining)}
          </div>
          <p className="text-xs uppercase tracking-wider text-gray-500">
            {timer?.phase ?? "ready"}
            {presc.setMode === "reps" ? ` · ${presc.setSize} reps target` : ""}
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {timer === null ? (
              <button type="button" onClick={start} className="rounded bg-white px-6 py-3 text-lg font-medium text-black hover:bg-gray-200">Start</button>
            ) : (
              <>
                <button type="button" onClick={togglePause} className="rounded bg-white px-6 py-3 text-lg font-medium text-black hover:bg-gray-200">
                  {timer.status === "running" ? "Pause" : "Resume"}
                </button>
                <button type="button" onClick={skipSet} className="rounded border border-white/20 px-6 py-3 text-lg hover:bg-white/5">Skip set</button>
                <button type="button" onClick={skipItem} className="rounded border border-white/20 px-6 py-3 text-lg hover:bg-white/5">Skip item</button>
              </>
            )}
          </div>
        </main>
      )}
    </div>
  );
}
