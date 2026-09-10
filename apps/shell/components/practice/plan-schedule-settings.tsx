"use client";

/**
 * Schedule, reminder and calendar-feed controls for a plan (SHAN-473).
 *
 * Start date and days-per-week were display-only before this phase, which made
 * the cadence unadjustable from the UI that renders it. Session time and
 * reminder exist for the ICS feed: a reminder here becomes a VALARM in the
 * subscriber's own calendar, which is the only notification path the site has.
 */

import { useState } from "react";
import {
  calendarFeedUrl,
  mintCalendarToken,
  revokeCalendarToken,
  type Plan,
  type PlanTree,
} from "@/lib/api/plans";

const inputClass = "rounded border border-white/15 bg-black/30 px-3 py-1.5 text-sm";
const ghostButton =
  "rounded border border-white/20 px-2 py-1 text-xs text-gray-400 hover:bg-white/5 disabled:opacity-50";

const REMINDER_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "No reminder" },
  { value: 0, label: "At start" },
  { value: 10, label: "10 min before" },
  { value: 30, label: "30 min before" },
  { value: 60, label: "1 hour before" },
  { value: 120, label: "2 hours before" },
  { value: 1440, label: "1 day before" },
];

type PlanPatch = Partial<
  Pick<Plan, "startDate" | "daysPerWeek" | "sessionTime" | "reminderMinutes">
>;

export function PlanScheduleSettings({
  plan,
  busy,
  onSave,
}: {
  plan: PlanTree;
  busy: boolean;
  onSave: (patch: PlanPatch) => void;
}) {
  const [token, setToken] = useState<string | null>(plan.icsToken);
  const [feedBusy, setFeedBusy] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const runFeed = async (fn: () => Promise<void>) => {
    setFeedBusy(true);
    setFeedError(null);
    try {
      await fn();
    } catch (e) {
      setFeedError((e as Error).message ?? "Calendar feed action failed");
    } finally {
      setFeedBusy(false);
    }
  };

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is permission-gated; the URL is on screen and selectable.
      setFeedError("Could not copy — select the URL and copy it by hand.");
    }
  };

  return (
    <section className="mt-8 rounded-md border border-white/10 bg-black/20 p-4">
      <h2 className="text-sm font-medium uppercase tracking-wider text-gray-400">
        Schedule &amp; reminders
      </h2>

      <div className="mt-3 flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-xs text-gray-400">
          Starts
          <input
            type="date"
            defaultValue={plan.startDate ?? ""}
            disabled={busy}
            aria-label="Plan start date"
            onChange={(e) => onSave({ startDate: e.target.value || null })}
            className={inputClass}
          />
        </label>

        <label className="flex items-center gap-2 text-xs text-gray-400">
          Days / week
          <select
            value={plan.daysPerWeek ?? ""}
            disabled={busy}
            aria-label="Sessions per week"
            onChange={(e) =>
              onSave({ daysPerWeek: e.target.value === "" ? null : Number(e.target.value) })
            }
            className={inputClass}
          >
            <option value="">Every day listed</option>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n}×
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-xs text-gray-400">
          Session time
          <input
            type="time"
            defaultValue={plan.sessionTime ?? ""}
            disabled={busy}
            aria-label="Session start time"
            onChange={(e) => onSave({ sessionTime: e.target.value || null })}
            className={inputClass}
          />
        </label>

        <label className="flex items-center gap-2 text-xs text-gray-400">
          Reminder
          <select
            value={plan.reminderMinutes ?? ""}
            disabled={busy}
            aria-label="Calendar reminder"
            onChange={(e) =>
              onSave({ reminderMinutes: e.target.value === "" ? null : Number(e.target.value) })
            }
            className={inputClass}
          >
            {REMINDER_OPTIONS.map((opt) => (
              <option key={opt.label} value={opt.value ?? ""}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="mt-2 text-xs text-gray-400">
        {plan.sessionTime
          ? `Sessions land at ${plan.sessionTime} in the calendar feed.`
          : "Without a session time the feed writes all-day events."}
        {plan.reminderMinutes !== null &&
          " The reminder fires in whichever calendar app subscribes to the feed."}
      </p>

      <div className="mt-4 border-t border-white/10 pt-4">
        <h3 className="text-xs font-medium uppercase tracking-wider text-gray-400">
          Calendar feed
        </h3>
        {token === null ? (
          <>
            <p className="mt-2 text-xs text-gray-400">
              Subscribe from Google or Apple Calendar to see scheduled sessions there.
            </p>
            <button
              type="button"
              disabled={feedBusy}
              onClick={() =>
                runFeed(async () => {
                  setToken(await mintCalendarToken(plan.id));
                })
              }
              className="mt-2 rounded border border-white/20 px-3 py-1.5 text-xs hover:bg-white/5 disabled:opacity-50"
            >
              {feedBusy ? "Creating…" : "Create subscribe link"}
            </button>
          </>
        ) : (
          <>
            <p className="mt-2 break-all rounded border border-white/10 bg-black/40 p-2 font-mono text-[11px] text-gray-300">
              {calendarFeedUrl(plan.id, token)}
            </p>
            <p className="mt-2 text-xs text-gray-400">
              Anyone with this URL can read the schedule — rotate it if it leaks.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => copyUrl(calendarFeedUrl(plan.id, token))}
                className={ghostButton}
              >
                {copied ? "Copied" : "Copy URL"}
              </button>
              <button
                type="button"
                disabled={feedBusy}
                onClick={() =>
                  runFeed(async () => {
                    setToken(await mintCalendarToken(plan.id, true));
                  })
                }
                className={ghostButton}
              >
                Rotate
              </button>
              <button
                type="button"
                disabled={feedBusy}
                onClick={() =>
                  runFeed(async () => {
                    await revokeCalendarToken(plan.id);
                    setToken(null);
                  })
                }
                className={ghostButton}
              >
                Revoke
              </button>
            </div>
          </>
        )}
        {feedError && (
          <p role="alert" className="mt-2 text-sm text-red-400">
            {feedError}
          </p>
        )}
      </div>
    </section>
  );
}
