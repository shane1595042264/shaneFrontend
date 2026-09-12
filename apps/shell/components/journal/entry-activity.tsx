"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { listEntryActivity, type JournalActivityRow } from "@/lib/api/journal-activity";
import { ActivityList } from "@/components/journal/journal-activity-feed";

const PAGE_SIZE = 20;

/**
 * The audit trail for one entry (SHAN-484), rendered below the comments.
 *
 * Collapsed by default and only fetched when opened: on a busy entry this is
 * the least-read block on the page, and it would otherwise add a request to
 * every entry view. Failures render as a quiet line rather than an error card —
 * the trail is supporting detail, not the reason the page exists.
 */
export function EntryActivity({ date }: { date: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<JournalActivityRow[] | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  // In-flight guard. It has to be a ref, not the `state` value: reading `state`
  // here would put it in the dep list below, and then setState("loading") would
  // re-run the effect and tear down the request it just started.
  const inFlight = useRef(false);

  useEffect(() => {
    // Reset when navigating between entries so a stale trail never shows under
    // a different date.
    setOpen(false);
    setRows(null);
    setState("idle");
    inFlight.current = false;
  }, [date]);

  useEffect(() => {
    if (!open || rows !== null || inFlight.current) return;
    inFlight.current = true;
    let cancelled = false;
    setState("loading");
    listEntryActivity(date, { limit: PAGE_SIZE })
      .then((page) => {
        inFlight.current = false;
        if (cancelled) return;
        setRows(page.activity);
        setState("idle");
      })
      .catch(() => {
        inFlight.current = false;
        if (cancelled) return;
        setState("error");
      });
    // Collapsing must not abort the request — the component stays mounted and
    // the result is still wanted on reopen. `cancelled` only suppresses a
    // response that arrives after the viewer has moved to another date.
    return () => {
      cancelled = true;
    };
  }, [open, rows, date]);

  return (
    <section className="mt-10 print:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-gray-200"
      >
        <span aria-hidden className={`transition-transform ${open ? "rotate-90" : ""}`}>
          ›
        </span>
        Activity on this entry
      </button>

      {open && (
        <div className="mt-3">
          {state === "loading" && (
            <p className="text-xs text-gray-400" aria-live="polite">
              Loading activity…
            </p>
          )}
          {state === "error" && (
            <p className="text-xs text-gray-400" aria-live="polite">
              Couldn&apos;t load activity for this entry.
            </p>
          )}
          {rows !== null && state !== "error" && (
            rows.length === 0 ? (
              <p className="text-xs text-gray-400">
                Nothing recorded yet — the audit trail starts from when it shipped.
              </p>
            ) : (
              <>
                <ActivityList rows={rows} showEntryLink={false} />
                {rows.length === PAGE_SIZE && (
                  <Link
                    href="/journal/activity"
                    className="mt-2 inline-block text-xs text-gray-400 hover:text-gray-200"
                  >
                    See the full journal activity feed →
                  </Link>
                )}
              </>
            )
          )}
        </div>
      )}
    </section>
  );
}
