"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { useHydrated } from "@/lib/use-hydrated";
import { readingProgress } from "@/lib/reading-position";

/** How long the percent stays up after the reader stops scrolling. */
const CHIP_LINGER_MS = 1400;
/** The restore scrolls the page right after load; that is not the reader moving. */
const RESTORE_QUIET_MS = 2600;
/** Hidden until the page has left its at-rest top, where the header is transparent. */
const SHOW_AFTER_PX = 64;

/**
 * SHAN-706: how far through the piece you are, as a hairline under the site
 * header plus a small percent that shows only while you scroll.
 *
 * - Measured with `readingProgress`, the rule a saved position uses, so the
 *   bar, the resume pill and the Continue card always agree on the number.
 * - Rides `--site-header-offset`: under the header while it shows, on the top
 *   edge once it slides away (SHAN-599), with the header's own easing.
 * - Driven by motion values, never React state per frame: a spring on the
 *   bar, the percent written straight into the DOM. State flips only when the
 *   bar or the chip appears or goes.
 * - Client-only, mounted after hydration, so the cached HTML of an ISR post
 *   is unchanged (SHAN-492). Decorative to assistive tech apart from the
 *   progressbar role on the bar itself.
 */
export function ReadingProgress({ articleRef }: { articleRef: RefObject<HTMLElement | null> }) {
  const hydrated = useHydrated();
  const reduce = useReducedMotion() ?? false;
  const { scrollY } = useScroll();
  const progress = useMotionValue(0);
  const smooth = useSpring(progress, { stiffness: 280, damping: 40, mass: 0.5, restDelta: 0.0005 });
  const percent = useTransform(progress, (p) => `${Math.round(p * 100)}%`);
  const [shown, setShown] = useState(false);
  const [active, setActive] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = articleRef.current;
    if (!root) return;
    const mountedAt = Date.now();
    let idleTimer = 0;
    let isShown = false;
    let isActive = false;

    const setChip = (on: boolean) => {
      if (on === isActive) return;
      isActive = on;
      setActive(on);
    };

    const update = (fromScroll: boolean) => {
      const p = readingProgress(root);
      progress.set(p);
      barRef.current?.setAttribute("aria-valuenow", String(Math.round(p * 100)));
      const visible = window.scrollY > SHOW_AFTER_PX && p > 0.003;
      if (visible !== isShown) {
        isShown = visible;
        setShown(visible);
      }
      if (!fromScroll) return;
      // The resume pill holds the same number and owns the top of a narrow
      // screen while it is up; the restore's own scrolling is not reading.
      const quiet = Date.now() - mountedAt < RESTORE_QUIET_MS || !!document.querySelector("[data-reading-pill]");
      if (!visible || quiet) {
        setChip(false);
        return;
      }
      setChip(true);
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => setChip(false), CHIP_LINGER_MS);
    };

    update(false);
    const unsubscribe = scrollY.on("change", () => update(true));
    // Images and diagrams loading change the article's height without a scroll.
    const resize = new ResizeObserver(() => update(false));
    resize.observe(root);
    return () => {
      unsubscribe();
      resize.disconnect();
      window.clearTimeout(idleTimer);
    };
  }, [articleRef, scrollY, progress]);

  if (!hydrated || typeof document === "undefined") return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-[var(--site-header-offset,0px)] z-40 transition-[top] duration-[420ms] ease-[var(--ease-glide)] motion-reduce:transition-none print:hidden">
      <motion.div
        ref={barRef}
        role="progressbar"
        aria-label="Reading progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-hidden={!shown}
        style={{ scaleX: reduce ? progress : smooth }}
        // No track behind it: the filled line is the whole signal. The
        // gradient compresses with the fill, so the line reads as a soft trail
        // brightening toward where you are.
        className={`h-[2px] origin-left bg-gradient-to-r from-blue-400/0 via-blue-400/60 to-blue-400 transition-opacity duration-300 ${
          shown ? "opacity-100" : "opacity-0"
        }`}
      />
      <div aria-hidden="true" className="flex justify-end px-3 pt-2 sm:px-5">
        <motion.span
          initial={false}
          animate={active ? { y: 0, opacity: 1 } : { y: reduce ? 0 : -6, opacity: 0 }}
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34, mass: 0.6 }}
          className="rounded-full border border-white/10 bg-gray-950/70 px-2 py-0.5 font-mono text-[11px] tabular-nums text-gray-300 shadow-[0_8px_24px_-12px_rgb(0_0_0/0.8)] backdrop-blur-md"
        >
          {percent}
        </motion.span>
      </div>
    </div>,
    document.body
  );
}
