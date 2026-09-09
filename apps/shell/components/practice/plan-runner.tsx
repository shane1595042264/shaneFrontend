"use client";

/**
 * Today view + day runner for a training plan (SHAN-471, Phase 3 of SHAN-467).
 *
 * Picks the day whose weekday matches the viewer's local date, renders its
 * blocks as a checklist, and runs one block at a time with the same
 * work/rest/set timer shape as the session runner in ./runner.tsx. Every set
 * boundary, pause and check-off writes to POST /plans/:planId/completions,
 * which is unique on (user, block, isoDate) — so a mid-set sync updates the
 * day's row rather than stacking duplicates.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { formatMMSS, playPing } from "@/lib/practice-timer";
import { getTodayInTimezone, resolveViewerTimezone, weekdayLongLabel } from "@/lib/timezone";
import {
  WEEKDAY_LABELS,
  describePrescription,
  listCompletions,
  recordCompletion,
  type PlanBlock,
  type PlanCompletion,
  type PlanTree,
} from "@/lib/api/plans";

/** How far back the streak/tally query looks. Longer than any streak worth showing. */
const HISTORY_DAYS = 90;

function shiftIso(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/**
 * Consecutive days with at least one completed block, counting back from
 * today — or from yesterday when today hasn't been started, so an unstarted
 * morning doesn't read as a broken streak.
 */
function computeStreak(doneDates: Set<string>, today: string): number {
  let cursor = doneDates.has(today) ? today : shiftIso(today, -1);
  let streak = 0;
  while (doneDates.has(cursor)) {
    streak += 1;
    cursor = shiftIso(cursor, -1);
  }
  return streak;
}

/**
 * Seconds a work set should last, or null when the block advances on a tap
 * instead of a clock: reps blocks always, and time blocks with no target.
 */
function workTarget(block: PlanBlock): number | null {
  return block.mode === "time" ? block.targetSeconds : null;
}

interface RunState {
  blockId: string;
  phase: "work" | "rest";
  status: "running" | "paused";
  /** 1-based set in progress. */
  currentSet: number;
  /** Sets banked today for this block, including sets from an earlier run. */
  setsCompleted: number;
  /** Seconds elapsed inside the current phase. */
  phaseElapsed: number;
  /** Work seconds banked today. Rest is idle, so counting it would inflate the volume read. */
  workSeconds: number;
}

const controlButton =
  "min-h-11 rounded border border-white/20 px-4 text-sm hover:bg-white/5 disabled:opacity-50";
const primaryButton =
  "min-h-11 rounded bg-white px-4 text-sm font-medium text-black hover:bg-gray-200";

export function PlanRunner({ plan }: { plan: PlanTree }) {
  const { user } = useAuth();
  const timezone = resolveViewerTimezone(user);
  const today = useMemo(() => getTodayInTimezone(timezone), [timezone]);
  const todayWeekday = useMemo(() => new Date(`${today}T00:00:00Z`).getUTCDay(), [today]);

  // Null until the viewer picks a day by hand; the derived `day` below falls
  // back to today's weekday, then to the first day.
  const [pickedDayId, setPickedDayId] = useState<string | null>(null);
  const [completions, setCompletions] = useState<Record<string, PlanCompletion>>({});
  const [history, setHistory] = useState<PlanCompletion[]>([]);
  const [loadingTally, setLoadingTally] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [run, setRun] = useState<RunState | null>(null);

  const day = useMemo(() => {
    if (pickedDayId) return plan.days.find((d) => d.id === pickedDayId) ?? null;
    return plan.days.find((d) => d.weekday === todayWeekday) ?? plan.days[0] ?? null;
  }, [pickedDayId, plan.days, todayWeekday]);

  const blocksById = useMemo(() => {
    const map = new Map<string, PlanBlock>();
    for (const d of plan.days) for (const b of d.blocks) map.set(b.id, b);
    return map;
  }, [plan.days]);

  // The interval and the pagehide handler both need the live run state without
  // re-subscribing every tick.
  const runRef = useRef<RunState | null>(null);
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  useEffect(() => {
    let cancelled = false;
    setLoadingTally(true);
    listCompletions(plan.id, { from: shiftIso(today, -(HISTORY_DAYS - 1)), to: today })
      .then((rows) => {
        if (cancelled) return;
        setHistory(rows);
        setCompletions(
          Object.fromEntries(rows.filter((r) => r.isoDate === today).map((r) => [r.blockId, r])),
        );
      })
      .catch((e) => {
        if (!cancelled) setSyncError((e as Error).message ?? "Could not load progress");
      })
      .finally(() => {
        if (!cancelled) setLoadingTally(false);
      });
    return () => {
      cancelled = true;
    };
  }, [plan.id, today]);

  /** Optimistic write — the checkbox and the tally shouldn't wait on the round trip. */
  const sync = useCallback(
    (blockId: string, setsCompleted: number, elapsedSeconds: number, completed: boolean) => {
      setCompletions((prev) => ({
        ...prev,
        [blockId]: {
          ...(prev[blockId] ?? {
            id: `pending-${blockId}`,
            userId: "",
            planId: plan.id,
            blockId,
            isoDate: today,
          }),
          setsCompleted,
          elapsedSeconds,
          completedAt: completed ? new Date().toISOString() : null,
        },
      }));
      return recordCompletion(plan.id, {
        blockId,
        isoDate: today,
        setsCompleted,
        elapsedSeconds,
        completed,
      })
        .then((row) => {
          setCompletions((prev) => ({ ...prev, [blockId]: row }));
          setSyncError(null);
        })
        .catch((e) => setSyncError((e as Error).message ?? "Could not save progress"));
    },
    [plan.id, today],
  );

  const finishSet = useCallback(
    (state: RunState, block: PlanBlock) => {
      const setsCompleted = state.setsCompleted + 1;
      const done = setsCompleted >= block.sets;
      playPing();
      void sync(block.id, setsCompleted, state.workSeconds, done);
      if (done) {
        setRun(null);
        return;
      }
      setRun(
        block.restSeconds > 0
          ? { ...state, setsCompleted, phase: "rest", phaseElapsed: 0 }
          : {
              ...state,
              setsCompleted,
              phase: "work",
              currentSet: state.currentSet + 1,
              phaseElapsed: 0,
            },
      );
    },
    [sync],
  );

  // One second-tick per phase. It reads live state from the ref so the boundary
  // work (ping + sync) runs in the callback rather than inside a setState updater.
  useEffect(() => {
    if (!run || run.status !== "running") return;
    const block = blocksById.get(run.blockId);
    if (!block) return;
    const id = setInterval(() => {
      const cur = runRef.current;
      if (!cur || cur.status !== "running") return;
      if (cur.phase === "rest") {
        if (cur.phaseElapsed + 1 >= block.restSeconds) {
          playPing();
          setRun({ ...cur, phase: "work", currentSet: cur.currentSet + 1, phaseElapsed: 0 });
        } else {
          setRun({ ...cur, phaseElapsed: cur.phaseElapsed + 1 });
        }
        return;
      }
      const next = {
        ...cur,
        phaseElapsed: cur.phaseElapsed + 1,
        workSeconds: cur.workSeconds + 1,
      };
      const target = workTarget(block);
      if (target !== null && next.phaseElapsed >= target) {
        finishSet(next, block);
        return;
      }
      setRun(next);
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.status, run?.blockId, run?.phase, blocksById, finishSet]);

  // Keep the screen awake mid-set, same as the session runner.
  const wakeLockRef = useRef<{ release?: () => Promise<void> } | null>(null);
  useEffect(() => {
    const release = () => {
      wakeLockRef.current?.release?.().catch(() => {});
      wakeLockRef.current = null;
    };
    if (run?.status !== "running") {
      release();
      return;
    }
    const nav = navigator as unknown as {
      wakeLock?: { request: (t: string) => Promise<{ release?: () => Promise<void> }> };
    };
    nav.wakeLock
      ?.request("screen")
      .then((wl) => {
        wakeLockRef.current = wl;
      })
      .catch(() => {});
    return release;
  }, [run?.status]);

  // Leaving the page mid-set shouldn't lose the sets already done.
  useEffect(() => {
    const persist = () => {
      const cur = runRef.current;
      if (!cur) return;
      const block = blocksById.get(cur.blockId);
      if (!block) return;
      void recordCompletion(
        plan.id,
        {
          blockId: cur.blockId,
          isoDate: today,
          setsCompleted: cur.setsCompleted,
          elapsedSeconds: cur.workSeconds,
          completed: cur.setsCompleted >= block.sets,
        },
        true,
      ).catch(() => {});
    };
    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", persist);
    return () => {
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", persist);
    };
  }, [plan.id, today, blocksById]);

  const startBlock = (block: PlanBlock) => {
    const existing = completions[block.id];
    const setsDone = existing?.setsCompleted ?? 0;
    setRun({
      blockId: block.id,
      phase: "work",
      status: "running",
      currentSet: Math.min(setsDone + 1, block.sets),
      setsCompleted: setsDone,
      phaseElapsed: 0,
      workSeconds: existing?.elapsedSeconds ?? 0,
    });
  };

  const togglePause = () => {
    // Read through the ref rather than a setState updater: the pause also
    // writes to the server, and an updater has to stay side-effect free.
    const cur = runRef.current;
    if (!cur) return;
    const pausing = cur.status === "running";
    setRun({ ...cur, status: pausing ? "paused" : "running" });
    if (pausing) void sync(cur.blockId, cur.setsCompleted, cur.workSeconds, false);
  };

  const stopRun = () => {
    const cur = runRef.current;
    setRun(null);
    if (!cur) return;
    const block = blocksById.get(cur.blockId);
    if (!block) return;
    void sync(cur.blockId, cur.setsCompleted, cur.workSeconds, cur.setsCompleted >= block.sets);
  };

  const toggleCheck = (block: PlanBlock) => {
    const existing = completions[block.id];
    const isDone = Boolean(existing?.completedAt);
    // Ticking the block that's mid-run ends the run — and takes its live tally,
    // which is ahead of the last synced row by however far into the set it got.
    const live = runRef.current?.blockId === block.id ? runRef.current : null;
    if (live) setRun(null);
    const bankedSets = Math.max(existing?.setsCompleted ?? 0, live?.setsCompleted ?? 0);
    const seconds = Math.max(existing?.elapsedSeconds ?? 0, live?.workSeconds ?? 0);
    // Un-checking keeps whatever tally was banked; checking a block that was
    // never run credits the full prescription.
    void sync(block.id, isDone ? bankedSets : Math.max(bankedSets, block.sets), seconds, !isDone);
  };

  const doneDates = useMemo(() => {
    const dates = new Set(history.filter((c) => c.completedAt).map((c) => c.isoDate));
    if (Object.values(completions).some((c) => c.completedAt)) dates.add(today);
    else dates.delete(today);
    return dates;
  }, [history, completions, today]);

  const blocks = day?.blocks ?? [];
  const doneToday = blocks.filter((b) => completions[b.id]?.completedAt).length;
  const secondsToday = blocks.reduce(
    (sum, b) => sum + (completions[b.id]?.elapsedSeconds ?? 0),
    0,
  );
  const streak = computeStreak(doneDates, today);
  const activeBlock = run ? (blocksById.get(run.blockId) ?? null) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link
        href={`/practice/plans/${plan.id}`}
        className="text-sm text-gray-400 hover:text-gray-300"
      >
        ← back to plan
      </Link>

      <header className="mt-3">
        <h1 className="text-2xl font-semibold">{plan.title}</h1>
        <p className="mt-2 text-xs text-gray-400">
          {weekdayLongLabel(today)}, {today}
          {plan.discipline && <> · {plan.discipline}</>}
        </p>
        <p className="mt-2 text-sm text-gray-300">
          {loadingTally ? (
            "Loading progress…"
          ) : (
            <>
              {doneToday} of {blocks.length} block{blocks.length === 1 ? "" : "s"} done
              {secondsToday > 0 && (
                <span className="text-gray-400"> · {formatMMSS(secondsToday)} logged</span>
              )}
              <span className="text-gray-400">
                {" "}
                · {streak === 0 ? "no streak yet" : `${streak}-day streak`}
              </span>
            </>
          )}
        </p>
      </header>

      {syncError && (
        <p role="alert" className="mt-4 text-sm text-red-400">
          {syncError}
        </p>
      )}

      {plan.days.length > 1 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {plan.days.map((d) => (
            <button
              key={d.id}
              type="button"
              aria-pressed={d.id === day?.id}
              onClick={() => {
                setPickedDayId(d.id);
                setRun(null);
              }}
              className={`rounded border px-3 py-1.5 text-sm ${
                d.id === day?.id ? "border-white bg-white/10" : "border-white/20 hover:bg-white/5"
              }`}
            >
              {d.label}
              {d.weekday !== null && (
                <span className="text-gray-400"> · {WEEKDAY_LABELS[d.weekday]}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {day === null ? (
        <p className="mt-8 text-sm text-gray-400">
          This plan has no days yet.{" "}
          <Link href={`/practice/plans/${plan.id}`} className="underline">
            Add one
          </Link>{" "}
          to start running it.
        </p>
      ) : blocks.length === 0 ? (
        <p className="mt-8 text-sm text-gray-400">
          {day.label} has no blocks yet.{" "}
          <Link href={`/practice/plans/${plan.id}`} className="underline">
            Add one
          </Link>
          .
        </p>
      ) : (
        <>
          {day.notes && <p className="mt-6 text-sm text-gray-300">{day.notes}</p>}
          <ul className="mt-6 space-y-3">
            {blocks.map((block) => {
              const completion = completions[block.id];
              const isDone = Boolean(completion?.completedAt);
              const isActive = run?.blockId === block.id;
              return (
                <li
                  key={block.id}
                  className={`rounded-md border p-4 ${
                    isActive ? "border-white/40 bg-black/40" : "border-white/10 bg-black/20"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isDone}
                      aria-label={`Mark ${block.title} done`}
                      onChange={() => toggleCheck(block)}
                      className="mt-1 h-5 w-5 shrink-0 accent-emerald-500"
                    />
                    <div className="min-w-0 flex-1">
                      <h2
                        className={`font-medium ${isDone ? "text-gray-400 line-through" : "text-white"}`}
                      >
                        {block.title}
                      </h2>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {block.kind} · {describePrescription(block)}
                        {completion && completion.setsCompleted > 0 && (
                          <>
                            {" "}
                            · {completion.setsCompleted}/{block.sets} sets logged
                            {completion.elapsedSeconds > 0 && (
                              <> · {formatMMSS(completion.elapsedSeconds)}</>
                            )}
                          </>
                        )}
                      </p>
                      {block.notes && <p className="mt-2 text-xs text-gray-400">{block.notes}</p>}
                    </div>
                    {!isActive && (
                      <button
                        type="button"
                        onClick={() => startBlock(block)}
                        className={controlButton}
                      >
                        {isDone ? "Run again" : "Start"}
                      </button>
                    )}
                  </div>

                  {isActive && run && activeBlock && (
                    <ActivePanel
                      block={activeBlock}
                      run={run}
                      onTogglePause={togglePause}
                      onSetDone={() => finishSet(run, activeBlock)}
                      onStop={stopRun}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

/** The running block: clock, set counter, the author's steps, and the controls. */
function ActivePanel({
  block,
  run,
  onTogglePause,
  onSetDone,
  onStop,
}: {
  block: PlanBlock;
  run: RunState;
  onTogglePause: () => void;
  onSetDone: () => void;
  onStop: () => void;
}) {
  const target = workTarget(block);
  const clock =
    run.phase === "rest"
      ? Math.max(0, block.restSeconds - run.phaseElapsed)
      : target !== null
        ? Math.max(0, target - run.phaseElapsed)
        : run.phaseElapsed;

  return (
    <div className="mt-4 border-t border-white/10 pt-4 text-center">
      <div
        className={`font-mono text-6xl tabular-nums ${
          run.phase === "rest" ? "text-emerald-400" : "text-blue-400"
        }`}
      >
        {formatMMSS(clock)}
      </div>
      <p className="mt-1 text-xs uppercase tracking-wider text-gray-400">
        {run.phase} · set {Math.min(run.currentSet, block.sets)} of {block.sets}
        {block.mode === "reps" && block.targetReps !== null && <> · {block.targetReps} reps</>}
      </p>

      {block.steps.length > 0 && (
        <ol className="mx-auto mt-4 max-w-md list-decimal space-y-1 pl-6 text-left text-sm text-gray-300">
          {block.steps.map((step) => (
            <li key={step.id}>
              {step.text}
              {step.reps !== null && <span className="text-gray-400"> · {step.reps} reps</span>}
              {step.durationSeconds !== null && (
                <span className="text-gray-400"> · {step.durationSeconds}s</span>
              )}
            </li>
          ))}
        </ol>
      )}

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={onTogglePause} className={primaryButton}>
          {run.status === "running" ? "Pause" : "Resume"}
        </button>
        {run.phase === "work" && (
          <button type="button" onClick={onSetDone} className={controlButton}>
            Set done
          </button>
        )}
        <button type="button" onClick={onStop} className={controlButton}>
          Stop
        </button>
      </div>
    </div>
  );
}
