"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { formatRelativeTime } from "@/lib/format-time";
import {
  getReadingPosition,
  saveReadingPosition,
  type ReadingPosition,
} from "@/lib/api/journal-reading";
import {
  READING_MARK_EVENT,
  capturePosition,
  capturePositionAt,
  isPastTheTop,
  readingSnippet,
  scrollTargetFor,
  type CapturedPosition,
} from "@/lib/reading-position";

/** How long the restore keeps re-asserting itself while images and diagrams finish loading above the spot. */
const RESTORE_WINDOW_MS = 2500;
const RESTORE_POLL_MS = 50;
/** How long to wait for the saved position before giving up and leaving the reader at the top. */
const FETCH_WAIT_MS = 1500;
/** Measure once scrolling pauses this long... */
const SETTLE_MS = 200;
/** ...and save once it has stayed paused this long. */
const SAVE_IDLE_MS = 1500;
/** Reading this long without scrolling still counts as reading. */
const DWELL_MS = 15_000;
/** Look for a newer spot from another device at most this often. */
const RECHECK_MS = 10_000;
/** A width change re-applies the reader's spot this long after the last resize event... */
const RESIZE_SETTLE_MS = 120;
/** ...and scrolls inside this window after it are the page reflowing, not the reader. */
const RESIZE_HOLD_MS = 450;

/** A reader taking over, as input rather than as a scroll event, for the reason MarkdownHashScroll gives. */
const TAKEOVER_EVENTS = ["wheel", "touchmove", "keydown", "mousedown"] as const;
const TAKEOVER_OPTIONS = { passive: true, capture: true } as const;

const SPRING = { type: "spring", stiffness: 420, damping: 34, mass: 0.8 } as const;

type Pill =
  | { kind: "resumed"; progress: number; text: string }
  | { kind: "elsewhere"; position: ReadingPosition; ahead: boolean }
  | null;

interface LocalCopy extends CapturedPosition {
  savedAt: number;
}

const localKey = (userId: string, date: string) => `shane:journal-reading:${userId}:${date}`;

function readLocal(key: string): LocalCopy | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as LocalCopy) : null;
  } catch {
    return null;
  }
}

function writeLocal(key: string, pos: CapturedPosition) {
  try {
    window.localStorage.setItem(key, JSON.stringify({ ...pos, savedAt: Date.now() }));
  } catch {
    // Private mode or a full quota: the server copy is the one that matters.
  }
}

function samePosition(a: CapturedPosition | null, b: CapturedPosition | null): boolean {
  return (
    !!a &&
    !!b &&
    a.anchor.block === b.anchor.block &&
    Math.abs(a.anchor.offset - b.anchor.offset) < 0.02 &&
    Math.abs(a.progress - b.progress) < 0.005
  );
}

interface Props {
  date: string;
  /** The article holding the entry and its appends: what a position is measured against. */
  articleRef: RefObject<HTMLElement | null>;
}

/**
 * SHAN-597: remembers where the reader is in this entry and brings them back.
 *
 * On open it scrolls to the saved spot (the server's copy, or this device's if
 * the server is slow or never got one), unless the URL names a section or the
 * reader has already started scrolling. After that, scroll is the only signal
 * that matters: the position is measured when scrolling pauses and saved when
 * it stays paused, so scrolling back up moves the saved spot back too. Three
 * moments save straight away, because a pause will not come: the tab being
 * hidden or closed (a keepalive request that outlives the page), leaving the
 * entry inside the site, and a note or an explanation landing, which places the
 * spot on that note. Merely opening an entry saves nothing, so glancing at one
 * on a phone never overwrites where you are on the laptop.
 */
export function ReadingTracker({ date, articleRef }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const reduce = useReducedMotion() ?? false;
  const [pill, setPill] = useState<Pill>(null);
  const pillTimer = useRef(0);
  // Lets the pill's buttons end the restore before scrolling somewhere else.
  const takeOver = useRef<() => void>(() => {});

  useEffect(() => {
    if (!articleRef.current || !userId) return;
    // Read the ref every time rather than holding the element: if the article
    // is ever replaced under this effect, a held one is detached and measures
    // as "finished, at the top".
    const live = () => articleRef.current;
    const key = localKey(userId, date);
    const openedAt = Date.now();
    let disposed = false;
    let tracking = false;
    let tookOver = false;
    let latest: CapturedPosition | null = null;
    let sent: CapturedPosition | null = null;
    // Where the reader is as far as this page knows: the last measurement, or
    // the restored spot before they have scrolled. What a resize re-applies.
    let here: CapturedPosition | null = null;
    let lastWidth = window.innerWidth;
    let resizeUntil = 0;
    let resizeTimer = 0;
    // updatedAt of the newest server copy this page knows about, own saves included.
    let knownServerAt = 0;
    let lastCheck = openedAt;
    let settleTimer = 0;
    let saveTimer = 0;
    let restoreTimer = 0;

    const capture = () => {
      const root = live();
      const pos = root ? capturePosition(root) : null;
      if (!pos) return;
      latest = pos;
      here = pos;
      writeLocal(key, pos);
    };

    const send = (keepalive = false) => {
      const pos = latest;
      if (!pos || samePosition(pos, sent)) return;
      sent = pos;
      saveReadingPosition(date, pos, { keepalive })
        .then((p) => {
          knownServerAt = Math.max(knownServerAt, Date.parse(p.updatedAt));
        })
        .catch(() => {
          // Let the next pause try again.
          if (sent === pos) sent = null;
        });
    };

    const startTracking = () => {
      tracking = true;
      window.clearTimeout(restoreTimer);
    };

    const onTakeOver = () => {
      tookOver = true;
      if (!tracking) startTracking();
    };
    takeOver.current = onTakeOver;

    // A width change (a rotated phone, a resized window) reflows the text, and
    // the scroll that follows is the page moving, not the reader. Hold saves
    // through it and put the reader back on their line once it settles. Height
    // alone is ignored: mobile browsers change it whenever the URL bar slides
    // during an ordinary scroll, and that scroll is the reader's.
    const onResize = () => {
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      resizeUntil = Date.now() + RESIZE_HOLD_MS;
      window.clearTimeout(settleTimer);
      window.clearTimeout(saveTimer);
      window.clearTimeout(resizeTimer);
      const pos = here;
      if (!pos || !tracking) return;
      resizeTimer = window.setTimeout(() => {
        const root = live();
        if (root?.isConnected) window.scrollTo({ top: scrollTargetFor(root, pos), behavior: "instant" });
      }, RESIZE_SETTLE_MS);
    };

    const onScroll = () => {
      if (!tracking || Date.now() < resizeUntil) return;
      window.clearTimeout(settleTimer);
      window.clearTimeout(saveTimer);
      settleTimer = window.setTimeout(() => {
        capture();
        saveTimer = window.setTimeout(() => send(), SAVE_IDLE_MS);
      }, SETTLE_MS);
    };

    // Hidden or closing: measure now, while the page is still laid out, and
    // send it in a request the browser finishes after the tab is gone.
    const flush = () => {
      if (!tookOver && !latest && Date.now() - openedAt < DWELL_MS) return;
      window.clearTimeout(settleTimer);
      window.clearTimeout(saveTimer);
      capture();
      send(true);
    };

    const checkElsewhere = async () => {
      if (Date.now() - lastCheck < RECHECK_MS) return;
      lastCheck = Date.now();
      try {
        const p = await getReadingPosition(date);
        if (disposed || !p) return;
        const at = Date.parse(p.updatedAt);
        if (at <= knownServerAt + 1000) return;
        knownServerAt = at;
        // Our own save from before the tab was hidden comes back as "newer"
        // when its response was still in flight; it is the same spot.
        const root = live();
        const here = latest ?? (root ? capturePosition(root) : null);
        if (here && here.anchor.block === p.anchor.block) return;
        setPill({ kind: "elsewhere", position: p, ahead: p.progress > (here?.progress ?? 0) });
      } catch {
        // Offline or signed out in another tab: nothing to offer.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
      else void checkElsewhere();
    };

    const onMark = (e: Event) => {
      const node = (e as CustomEvent<{ node?: Node }>).detail?.node;
      const root = live();
      const pos = node && root ? capturePositionAt(root, node) : null;
      if (!pos) return;
      startTracking();
      tookOver = true;
      window.clearTimeout(settleTimer);
      window.clearTimeout(saveTimer);
      latest = pos;
      here = pos;
      writeLocal(key, pos);
      send();
    };

    const restore = async () => {
      const local = readLocal(key);
      let server: ReadingPosition | null | undefined;
      try {
        server = await Promise.race([
          getReadingPosition(date),
          new Promise<undefined>((r) => window.setTimeout(() => r(undefined), FETCH_WAIT_MS)),
        ]);
      } catch {
        server = undefined;
      }
      if (disposed) return;
      if (server) knownServerAt = Date.parse(server.updatedAt);
      // The server's copy is the synced one. This device's copy only stands in
      // when the server is slow, down, or never received a save.
      const chosen: CapturedPosition | null = server ?? local;
      const skip =
        !chosen ||
        !isPastTheTop(chosen) ||
        // A #section link means "take me there", which beats "where I was".
        !!window.location.hash ||
        tookOver ||
        window.scrollY > 80 ||
        // Nowhere to go: a short entry saves as read (its end is on screen
        // from the start), and "picked up where you left off" without moving
        // would be noise.
        (() => {
          const root = live();
          return !root || scrollTargetFor(root, chosen) < 80;
        })();
      if (skip) {
        startTracking();
        return;
      }
      here = chosen;
      const deadline = Date.now() + RESTORE_WINDOW_MS;
      const attempt = () => {
        restoreTimer = 0;
        if (disposed) return;
        if (tookOver) {
          startTracking();
          return;
        }
        const root = live();
        if (!root?.isConnected) {
          startTracking();
          return;
        }
        const target = scrollTargetFor(root, chosen);
        // "instant" rather than "auto": "auto" defers to CSS scroll-behavior.
        if (Math.abs(window.scrollY - target) > 2) window.scrollTo({ top: target, behavior: "instant" });
        if (Date.now() < deadline) restoreTimer = window.setTimeout(attempt, RESTORE_POLL_MS);
        else startTracking();
      };
      attempt();
      setPill({ kind: "resumed", progress: chosen.progress, text: chosen.anchor.text });
    };

    for (const t of TAKEOVER_EVENTS) window.addEventListener(t, onTakeOver, TAKEOVER_OPTIONS);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener(READING_MARK_EVENT, onMark);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    const dwellTimer = window.setTimeout(() => {
      if (!latest) capture();
    }, DWELL_MS);
    void restore();

    return () => {
      disposed = true;
      for (const t of TAKEOVER_EVENTS) window.removeEventListener(t, onTakeOver, TAKEOVER_OPTIONS);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener(READING_MARK_EVENT, onMark);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearTimeout(settleTimer);
      window.clearTimeout(saveTimer);
      window.clearTimeout(restoreTimer);
      window.clearTimeout(resizeTimer);
      window.clearTimeout(dwellTimer);
      // Leaving for another page of the site: the article may already be gone,
      // so send the last measurement rather than taking a new one.
      send(true);
    };
  }, [date, userId, articleRef]);

  // The pill goes away on its own unless the pointer is resting on it.
  useEffect(() => {
    window.clearTimeout(pillTimer.current);
    if (!pill) return;
    pillTimer.current = window.setTimeout(() => setPill(null), pill.kind === "resumed" ? 6000 : 15000);
    return () => window.clearTimeout(pillTimer.current);
  }, [pill]);

  const holdPill = () => window.clearTimeout(pillTimer.current);
  const releasePill = () => {
    window.clearTimeout(pillTimer.current);
    pillTimer.current = window.setTimeout(() => setPill(null), 2500);
  };

  const backToTop = () => {
    const root = articleRef.current;
    takeOver.current();
    setPill(null);
    if (!root) return;
    window.scrollTo({
      top: Math.max(0, window.scrollY + root.getBoundingClientRect().top - 24),
      behavior: reduce ? "instant" : "smooth",
    });
  };

  const jumpTo = (p: ReadingPosition) => {
    const root = articleRef.current;
    takeOver.current();
    setPill(null);
    if (!root) return;
    window.scrollTo({ top: scrollTargetFor(root, p), behavior: reduce ? "instant" : "smooth" });
  };

  if (typeof document === "undefined") return null;

  const progress = pill ? (pill.kind === "resumed" ? pill.progress : pill.position.progress) : 0;
  const pct = Math.round(progress * 100);

  return createPortal(
    // Below the site header while it is showing (SHAN-599), at the top edge otherwise.
    <div className="pointer-events-none fixed inset-x-0 top-[calc(var(--site-header-offset,0px)+max(1rem,env(safe-area-inset-top)))] z-40 flex justify-center px-4 transition-[top] duration-[420ms] ease-[var(--ease-glide)] motion-reduce:transition-none print:hidden">
      <AnimatePresence>
        {pill && (
          <motion.div
            key={pill.kind}
            role="status"
            aria-live="polite"
            // Transform only on the way in: an overlay that starts at opacity 0
            // is the SHAN-549 trap, and the scale reads as arriving anyway.
            initial={reduce ? false : { y: -14, scale: 0.94 }}
            animate={{ y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { y: -10, scale: 0.97, opacity: 0, transition: { duration: 0.16 } }}
            transition={SPRING}
            onPointerEnter={holdPill}
            onPointerLeave={releasePill}
            onFocus={holdPill}
            onBlur={releasePill}
            className="pointer-events-auto flex max-w-full items-center gap-3 rounded-full border border-white/10 bg-gray-950/85 py-1.5 pl-1.5 pr-1.5 shadow-[0_16px_40px_rgb(0_0_0/0.45)] backdrop-blur-xl"
          >
            <span
              aria-hidden="true"
              style={{
                background: `conic-gradient(var(--color-blue-400) ${Math.round(progress * 360)}deg, rgb(255 255 255 / 0.1) 0deg)`,
              }}
              className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full"
            >
              <span className="absolute inset-[3px] rounded-full bg-gray-950" />
              <span className="relative font-mono text-[10px] tabular-nums text-gray-300">{pct}%</span>
            </span>
            <span className="min-w-0 text-[13px] leading-tight text-white">
              {pill.kind === "resumed" ? (
                <>
                  <span className="block truncate">Picked up where you left off</span>
                  <span className="block max-w-[16rem] truncate text-[11px] text-gray-400">
                    {pill.text ? `“${readingSnippet(pill.text)}”` : `${pct}% through this entry`}
                  </span>
                </>
              ) : (
                <>
                  <span className="block truncate">
                    {pill.ahead ? "Further along on another device" : "Earlier spot on another device"}
                  </span>
                  <span className="block font-mono text-[10px] text-gray-400">
                    saved {formatRelativeTime(pill.position.updatedAt)}
                  </span>
                </>
              )}
            </span>
            <button
              type="button"
              onClick={() => (pill.kind === "resumed" ? backToTop() : jumpTo(pill.position))}
              className="shrink-0 rounded-full bg-white/[0.08] px-3 py-1.5 text-xs font-medium text-white transition-[background-color,scale] hover:bg-white/[0.14] active:scale-[0.97]"
            >
              {pill.kind === "resumed" ? "Back to top" : "Jump there"}
            </button>
            <button
              type="button"
              onClick={() => setPill(null)}
              aria-label="Dismiss"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-gray-400 transition-colors hover:bg-white/[0.08] hover:text-white"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body
  );
}
