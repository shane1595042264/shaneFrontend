"use client";

import { useEffect, useRef } from "react";

/**
 * SHAN-659. The keys for a course, on one sheet behind `?`. The lesson player
 * and the course page each own their own keydown handling and close this on
 * Escape or `?`; while it is up, `data-keys-sheet` tells every answer key to
 * stand down (see keysBlocked in exercises.tsx).
 */

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-grid h-6 min-w-6 place-items-center rounded-md border border-white/15 bg-white/[0.03] px-1.5 align-middle font-mono text-[11px] leading-none text-gray-200">
      {children}
    </kbd>
  );
}

type Row = { keys: React.ReactNode; does: string };

const COURSE: Row[] = [
  { keys: <Kbd>r</Kbd>, does: "Resume where you left off, or start the next lesson" },
  {
    keys: (
      <>
        <Kbd>j</Kbd> <Kbd>k</Kbd>
      </>
    ),
    does: "Move down and up the lessons",
  },
  {
    keys: (
      <>
        <Kbd>g</Kbd> <Kbd>G</Kbd>
      </>
    ),
    does: "First and last lesson",
  },
  { keys: <Kbd>Enter</Kbd>, does: "Open the lesson you are on" },
];

const LESSON: Row[] = [
  {
    keys: (
      <>
        <Kbd>1</Kbd> to <Kbd>0</Kbd>, then <Kbd>a</Kbd>...
      </>
    ),
    does: "Pick the answer, tile or item with that key",
  },
  { keys: <Kbd>Backspace</Kbd>, does: "Take back the last tile, item or pick" },
  { keys: <Kbd>Enter</Kbd>, does: "Check, then continue" },
  { keys: <Kbd>Tab</Kbd>, does: "Next blank when typing, or next button" },
  { keys: <Kbd>Esc</Kbd>, does: "Leave the lesson. Your place is kept" },
];

export function ShortcutSheet({ scope, onClose }: { scope: "course" | "lesson"; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    return () => prev?.focus?.({ preventScroll: true });
  }, []);

  const groups: { title: string; rows: Row[] }[] =
    scope === "course"
      ? [
          { title: "Course page", rows: COURSE },
          { title: "In a lesson", rows: LESSON },
        ]
      : [{ title: "In a lesson", rows: LESSON }];

  return (
    <div
      data-keys-sheet=""
      className="fixed inset-0 z-[65] flex items-end justify-center bg-black/70 p-4 md:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="keys-sheet-heading"
        className="w-full max-w-md rounded-2xl border border-white/10 bg-gray-950 p-5"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 id="keys-sheet-heading" className="text-base font-semibold text-white">
            Keyboard
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-gray-400 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            Close <span className="sr-only">keyboard shortcuts</span>
            <span aria-hidden="true" className="ml-1 font-mono text-xs text-gray-400">
              esc
            </span>
          </button>
        </div>
        {groups.map((g) => (
          <section key={g.title} className="mt-5">
            <h3 className="text-xs font-medium uppercase tracking-wide text-gray-400">{g.title}</h3>
            <dl className="mt-2 divide-y divide-white/[0.06]">
              {g.rows.map((r) => (
                <div key={r.does} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                  <dt className="shrink-0 text-gray-300">{r.keys}</dt>
                  <dd className="text-right text-gray-400">{r.does}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
        <p className="mt-4 text-xs text-gray-400">
          Press <Kbd>?</Kbd> any time to see this again.
        </p>
      </div>
    </div>
  );
}
