"use client";

/**
 * Month calendar for a training plan (SHAN-473, Phase 4 of SHAN-467).
 *
 * Two layers on one grid: what the cadence says you should do (from
 * lib/plan-schedule, no API call) and what you actually did (from
 * GET /completions over the visible month). The gap between them is the whole
 * point of looking at it.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addDays,
  resolveCadence,
  scheduledDaysOn,
  type ScheduleDay,
} from "@/lib/plan-schedule";
import { WEEKDAY_LABELS, listCompletions, type PlanTree } from "@/lib/api/plans";

const WEEKDAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month, 1)));
}

function isoOf(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Monday-first offset of the 1st, and the day count, for a month grid. */
function monthGrid(year: number, month: number): { lead: number; days: number } {
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  return {
    lead: (firstWeekday + 6) % 7,
    days: new Date(Date.UTC(year, month + 1, 0)).getUTCDate(),
  };
}

/** One line of plain English for the cadence, so the grid is not a riddle. */
function describeCadence(plan: PlanTree): string {
  if (plan.days.length === 0) return "No days yet — nothing is scheduled.";
  const cadence = resolveCadence(plan);
  const parts: string[] = [];
  for (const [weekday, days] of [...cadence.pinned.entries()].sort((a, b) => a[0] - b[0])) {
    parts.push(`${days.map((d) => d.label).join(" + ")} every ${WEEKDAY_LABELS[weekday]}`);
  }
  if (cadence.floatingDays.length > 0 && cadence.floatingWeekdays.length > 0) {
    const slots = cadence.floatingWeekdays.map((w) => WEEKDAY_LABELS[w]).join(", ");
    parts.push(
      cadence.floatingDays.length > cadence.floatingWeekdays.length
        ? `${cadence.floatingDays.length} rotating days on ${slots}`
        : `${cadence.floatingDays.map((d) => d.label).join(", ")} on ${slots}`,
    );
  }
  const suffix = plan.startDate ? ` · from ${plan.startDate}` : "";
  return parts.length > 0 ? `${parts.join(" · ")}${suffix}` : "Nothing is scheduled.";
}

export function PlanCalendar({ plan, today }: { plan: PlanTree; today: string }) {
  const [cursor, setCursor] = useState(() => ({
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)) - 1,
  }));
  // Dates with at least one block ticked off. Undefined while loading, so an
  // empty month does not flash as "nothing done" before the fetch lands.
  const [doneDates, setDoneDates] = useState<Set<string> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { lead, days } = useMemo(
    () => monthGrid(cursor.year, cursor.month),
    [cursor.year, cursor.month],
  );
  const from = isoOf(cursor.year, cursor.month, 1);
  const to = isoOf(cursor.year, cursor.month, days);

  useEffect(() => {
    let cancelled = false;
    setDoneDates(null);
    setError(null);
    listCompletions(plan.id, { from, to })
      .then((rows) => {
        if (cancelled) return;
        setDoneDates(new Set(rows.filter((r) => r.completedAt).map((r) => r.isoDate)));
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message ?? "Could not load history");
      });
    return () => {
      cancelled = true;
    };
  }, [plan.id, from, to]);

  const cadence = useMemo(() => resolveCadence(plan), [plan]);

  const cells = useMemo(() => {
    const out: { iso: string; day: number; scheduled: ScheduleDay[] }[] = [];
    for (let d = 1; d <= days; d += 1) {
      const iso = isoOf(cursor.year, cursor.month, d);
      out.push({ iso, day: d, scheduled: scheduledDaysOn(plan, iso, cadence) });
    }
    return out;
  }, [cursor.year, cursor.month, days, plan, cadence]);

  const scheduledCount = cells.filter((c) => c.scheduled.length > 0).length;
  const doneCount = doneDates ? cells.filter((c) => doneDates.has(c.iso)).length : null;

  const shiftMonth = (delta: number) =>
    setCursor(({ year, month }) => {
      const next = month + delta;
      return { year: year + Math.floor(next / 12), month: ((next % 12) + 12) % 12 };
    });

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wider text-gray-400">Calendar</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => shiftMonth(-1)}
            className="min-h-8 rounded border border-white/20 px-2 text-xs hover:bg-white/5"
          >
            ←
          </button>
          <span className="min-w-36 text-center text-sm">
            {monthLabel(cursor.year, cursor.month)}
          </span>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
            className="min-h-8 rounded border border-white/20 px-2 text-xs hover:bg-white/5"
          >
            →
          </button>
        </div>
      </div>

      <p className="mt-2 text-xs text-gray-400">{describeCadence(plan)}</p>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wider text-gray-400">
        {WEEKDAY_HEADERS.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: lead }, (_, i) => (
          <div key={`lead-${i}`} aria-hidden />
        ))}
        {cells.map((cell) => {
          const done = doneDates?.has(cell.iso) ?? false;
          const scheduled = cell.scheduled.length > 0;
          const isToday = cell.iso === today;
          const label = cell.scheduled.map((d) => d.label).join(" + ");
          return (
            <div
              key={cell.iso}
              title={
                scheduled ? `${cell.iso} · ${label}${done ? " · done" : ""}` : `${cell.iso} · rest`
              }
              className={`min-h-14 rounded border p-1 text-left ${
                done
                  ? "border-emerald-500/60 bg-emerald-500/10"
                  : scheduled
                    ? "border-white/25 bg-black/30"
                    : "border-white/5 bg-black/10"
              } ${isToday ? "ring-1 ring-white/70" : ""}`}
            >
              <div className="flex items-start justify-between gap-1">
                <span className={`text-xs ${scheduled ? "text-white" : "text-gray-400"}`}>
                  {cell.day}
                </span>
                {done && (
                  <span aria-label="completed" className="text-xs text-emerald-400">
                    ✓
                  </span>
                )}
              </div>
              {scheduled && (
                <p className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-gray-300">
                  {label}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-gray-400">
        {scheduledCount} session{scheduledCount === 1 ? "" : "s"} scheduled
        {doneCount === null ? " · loading history…" : ` · ${doneCount} completed`}
        {" · "}
        <Link href={`/practice/plans/${plan.id}/today`} className="underline">
          run today
        </Link>
      </p>
    </section>
  );
}
