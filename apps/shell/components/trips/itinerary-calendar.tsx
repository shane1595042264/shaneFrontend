"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { TripItinerary, ItineraryActivity } from "@/lib/api/trip-groups";

/**
 * Google-Calendar-style week grid over the trip itinerary (SHAN-277).
 * Columns are days (real dates when the itinerary carries them, "Day N"
 * otherwise); timed activities are positioned on an hour grid, untimed
 * ones sit in an all-day band. Clicking an event opens an inline editor;
 * Save bubbles the whole modified itinerary up through onSave, which
 * reuses the PUT semantics (owner direct write, member suggestion).
 */

const HOUR_PX = 44;

export function fmtDayDate(date: string | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" });
}

interface Selected {
  dayIdx: number;
  actIdx: number;
}

export function ItineraryCalendar({
  itinerary,
  canEdit,
  saving,
  onSave,
}: {
  itinerary: TripItinerary;
  canEdit: boolean;
  saving: boolean;
  onSave: (next: TripItinerary) => Promise<void>;
}) {
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Selected | null>(null);

  const PER_PAGE = 7;
  const pages = Math.ceil(itinerary.days.length / PER_PAGE);
  const days = itinerary.days.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);

  // Hour range covering every timed activity, padded one hour each side.
  const [startHour, endHour] = useMemo(() => {
    let min = 9;
    let max = 18;
    for (const d of itinerary.days) {
      for (const a of d.activities) {
        const h = a.time ? Number(a.time.split(":")[0]) : NaN;
        if (Number.isFinite(h)) {
          min = Math.min(min, h);
          max = Math.max(max, h + 1);
        }
      }
    }
    return [Math.max(0, min - 1), Math.min(24, max + 1)];
  }, [itinerary]);

  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

  function activityTop(time: string): number {
    const [h, m] = time.split(":").map(Number);
    return ((h ?? 0) - startHour) * HOUR_PX + (((m ?? 0) / 60) * HOUR_PX);
  }

  return (
    <div>
      {pages > 1 && (
        <div className="mb-2 flex items-center justify-end gap-2 text-xs text-gray-400">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded border border-white/20 px-2 py-1 hover:bg-white/10 disabled:opacity-30"
          >
            ← prev
          </button>
          <span>
            days {page * PER_PAGE + 1}–{Math.min(itinerary.days.length, (page + 1) * PER_PAGE)} of{" "}
            {itinerary.days.length}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            disabled={page >= pages - 1}
            className="rounded border border-white/20 px-2 py-1 hover:bg-white/10 disabled:opacity-30"
          >
            next →
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-white/10 bg-black/20">
        <div
          className="grid min-w-[640px]"
          style={{ gridTemplateColumns: `48px repeat(${days.length}, minmax(80px, 1fr))` }}
        >
          {/* header row */}
          <div className="border-b border-white/10" />
          {days.map((d) => (
            <div
              key={d.day}
              className="border-b border-l border-white/10 px-1.5 py-2 text-center"
            >
              <div className="text-[11px] font-medium text-white/90">
                {fmtDayDate(d.date) ?? `Day ${d.day}`}
              </div>
              <div className="truncate text-[10px] text-gray-500">
                {d.location ?? d.title}
              </div>
            </div>
          ))}

          {/* all-day band (untimed activities) */}
          <div className="border-b border-white/10 px-1 py-1 text-right text-[9px] uppercase tracking-wide text-gray-600">
            all day
          </div>
          {days.map((d) => {
            const dayIdx = itinerary.days.indexOf(d);
            return (
              <div key={d.day} className="min-h-8 border-b border-l border-white/10 p-0.5">
                {d.activities.map((a, ai) =>
                  a.time ? null : (
                    <button
                      key={ai}
                      type="button"
                      onClick={() => setSelected({ dayIdx, actIdx: ai })}
                      className="mb-0.5 block w-full truncate rounded bg-amber-500/25 px-1 py-0.5 text-left text-[10px] text-amber-100 hover:bg-amber-500/40"
                    >
                      {a.title}
                    </button>
                  ),
                )}
              </div>
            );
          })}

          {/* hour grid */}
          <div className="relative">
            {hours.map((h) => (
              <div
                key={h}
                style={{ height: HOUR_PX }}
                className="pr-1 text-right text-[9px] leading-3 text-gray-600"
              >
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          {days.map((d) => {
            const dayIdx = itinerary.days.indexOf(d);
            return (
              <div
                key={d.day}
                className="relative border-l border-white/10"
                style={{ height: hours.length * HOUR_PX }}
              >
                {hours.map((h) => (
                  <div
                    key={h}
                    style={{ height: HOUR_PX }}
                    className="border-b border-white/5"
                  />
                ))}
                {d.activities.map((a, ai) =>
                  a.time ? (
                    <button
                      key={ai}
                      type="button"
                      onClick={() => setSelected({ dayIdx, actIdx: ai })}
                      style={{ top: activityTop(a.time), minHeight: 30 }}
                      className="absolute inset-x-0.5 z-10 overflow-hidden rounded border-l-2 border-blue-400 bg-blue-500/30 px-1 py-0.5 text-left text-[10px] leading-tight text-blue-50 hover:bg-blue-500/50"
                    >
                      <span className="font-mono text-[9px] text-blue-200">{a.time}</span>{" "}
                      {a.title}
                    </button>
                  ) : null,
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selected && (
        <EventEditor
          itinerary={itinerary}
          selected={selected}
          canEdit={canEdit}
          saving={saving}
          onClose={() => setSelected(null)}
          onSave={async (next) => {
            await onSave(next);
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}

function EventEditor({
  itinerary,
  selected,
  canEdit,
  saving,
  onClose,
  onSave,
}: {
  itinerary: TripItinerary;
  selected: Selected;
  canEdit: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (next: TripItinerary) => Promise<void>;
}) {
  const day = itinerary.days[selected.dayIdx];
  const activity = day?.activities[selected.actIdx];
  const [time, setTime] = useState(activity?.time ?? "");
  const [title, setTitle] = useState(activity?.title ?? "");
  const [notes, setNotes] = useState(activity?.notes ?? "");

  if (!day || !activity) return null;

  function buildNext(patch: Partial<ItineraryActivity> | null): TripItinerary {
    const days = itinerary.days.map((d, di) =>
      di === selected.dayIdx
        ? {
            ...d,
            activities:
              patch === null
                ? d.activities.filter((_, ai) => ai !== selected.actIdx)
                : d.activities.map((a, ai) =>
                    ai === selected.actIdx ? { ...a, ...patch } : a,
                  ),
          }
        : d,
    );
    return { ...itinerary, days };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await onSave(
      buildNext({
        time: /^\d{1,2}:\d{2}$/.test(time.trim()) ? time.trim().padStart(5, "0") : null,
        title: title.trim(),
        notes: notes.trim() || null,
      }),
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Edit activity"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-white/15 bg-neutral-900 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 text-sm font-medium text-white/90">
          {fmtDayDate(day.date) ?? `Day ${day.day}`}
          {day.location && <span className="ml-2 text-xs text-gray-500">{day.location}</span>}
        </h3>
        {canEdit ? (
          <form onSubmit={handleSubmit} className="space-y-2">
            <input
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="HH:MM (empty = all day)"
              aria-label="Time"
              className="block w-full rounded border border-white/15 bg-black/30 px-2 py-1.5 font-mono text-sm text-white/90 focus:border-white/40 focus:outline-none"
            />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-label="Title"
              className="block w-full rounded border border-white/15 bg-black/30 px-2 py-1.5 text-sm text-white/90 focus:border-white/40 focus:outline-none"
            />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="notes"
              rows={2}
              aria-label="Notes"
              className="block w-full rounded border border-white/15 bg-black/30 px-2 py-1.5 text-sm text-white/90 focus:border-white/40 focus:outline-none"
            />
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => onSave(buildNext(null))}
                disabled={saving}
                className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
              >
                Delete activity
              </button>
              <span className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="rounded border border-white/20 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/10 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !title.trim()}
                  className="rounded bg-green-600/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </span>
            </div>
          </form>
        ) : (
          <div className="text-sm text-gray-300">
            <p>
              <span className="font-mono text-xs text-gray-500">{activity.time ?? "all day"}</span>{" "}
              {activity.title}
            </p>
            {activity.notes && <p className="mt-1 text-xs text-gray-500">{activity.notes}</p>}
            <button
              type="button"
              onClick={onClose}
              className="mt-3 rounded border border-white/20 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/10"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
