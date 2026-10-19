"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useMotionValueEvent, useScroll } from "framer-motion";

/**
 * SHAN-599: the site header follows the reader.
 *
 *   top     resting at the top of the page, transparent, exactly as before
 *   pinned  showing over the content, on glass
 *   hidden  slid up out of the way while the reader moves down the page
 *
 * Hiding follows the scroll itself: any run downward past the header's own
 * height. Showing follows intent, not the scroll: an upward wheel, a swipe
 * down, an up key, the pointer reaching the top edge, or focus landing inside
 * the header. That split is deliberate. The page scrolls itself upward in
 * several places (a contents-rail jump to an earlier section, the reading
 * position being restored, Back to top), and a header that dropped in on every
 * one of those would land on top of the heading the reader just jumped to.
 */
export type SiteHeaderMode = "top" | "pinned" | "hidden";

/** The header's height, and how far sticky rails sit below it while it shows. */
export const SITE_HEADER_HEIGHT = "4rem";

/** Within this of the top the header is at rest. */
const TOP_ZONE = 8;
/** Never hide while the header is still over its own spot in the page. */
const HIDE_AFTER = 64;
/** A downward run shorter than this is jitter, not reading. */
const DOWN_RUN = 6;
/** Upward wheel travel that counts as "take me back". Trackpads emit tiny deltas. */
const WHEEL_UP = 24;
/** Finger travel that counts as a swipe toward the top. */
const SWIPE = 14;
/** The pointer this close to the top edge summons the header. */
const EDGE = 10;

const UP_KEYS = new Set(["ArrowUp", "PageUp", "Home"]);

function isEditable(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
}

/**
 * @param hold keep the header showing (menu open, focus or pointer inside it).
 * @param headerRef the header element, so a Tab can snap it into view.
 */
export function useSiteHeader(
  hold: boolean,
  headerRef: RefObject<HTMLElement | null>
): SiteHeaderMode {
  const [mode, setMode] = useState<SiteHeaderMode>("top");
  const modeRef = useRef<SiteHeaderMode>("top");
  const holdRef = useRef(hold);
  holdRef.current = hold;
  // Where the current downward run began; reset whenever the page moves up.
  const runStart = useRef(0);
  const { scrollY } = useScroll();

  const set = useCallback((next: SiteHeaderMode) => {
    if (modeRef.current === next) return;
    modeRef.current = next;
    setMode(next);
  }, []);

  const reveal = useCallback(() => {
    if (window.scrollY > TOP_ZONE) set("pinned");
  }, [set]);

  useMotionValueEvent(scrollY, "change", (y) => {
    if (y <= TOP_ZONE) {
      runStart.current = y;
      set("top");
      return;
    }
    if (y < runStart.current) {
      runStart.current = y;
    } else if (y - runStart.current > DOWN_RUN && y > HIDE_AFTER && !holdRef.current) {
      runStart.current = y;
      set("hidden");
      return;
    }
    // Left the top without a downward run long enough to hide: content is now
    // passing under the header, so it needs its glass.
    if (modeRef.current === "top") set("pinned");
  });

  // A page that opens already scrolled (a reload mid-page, the browser's own
  // restoration) starts with the header showing: the reader just arrived.
  useEffect(() => {
    runStart.current = window.scrollY;
    if (window.scrollY > TOP_ZONE) set("pinned");
  }, [set]);

  useEffect(() => {
    if (hold) reveal();
  }, [hold, reveal]);

  useEffect(() => {
    let wheelUp = 0;
    let wheelTimer = 0;
    let touchY: number | null = null;

    const onWheel = (e: WheelEvent) => {
      if (e.deltaY >= 0) {
        wheelUp = 0;
        return;
      }
      wheelUp -= e.deltaY;
      window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => (wheelUp = 0), 220);
      if (wheelUp >= WHEEL_UP) reveal();
    };
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      if (touchY === null || y === undefined) return;
      // A finger moving down the glass moves the page up.
      if (y - touchY > SWIPE) reveal();
      if (Math.abs(y - touchY) > SWIPE) touchY = y;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      // Tab may be about to land on a link in the header. Focusing an element
      // that is off screen makes the browser scroll the page to it, which
      // threw the reader 500px up the page. So snap the header in before focus
      // moves, with no slide: a header mid-transition is still off screen.
      if (e.key === "Tab" && modeRef.current === "hidden") {
        const el = headerRef.current;
        if (el) {
          el.style.transition = "none";
          el.dataset.mode = "pinned";
          void el.offsetHeight;
          window.requestAnimationFrame(() => {
            el.style.transition = "";
          });
        }
        set("pinned");
        return;
      }
      if (isEditable(e.target)) return;
      if (UP_KEYS.has(e.key) || (e.key === " " && e.shiftKey)) reveal();
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.clientY <= EDGE) reveal();
    };

    const passive = { passive: true } as const;
    window.addEventListener("wheel", onWheel, passive);
    window.addEventListener("touchstart", onTouchStart, passive);
    window.addEventListener("touchmove", onTouchMove, passive);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointermove", onPointerMove, passive);
    return () => {
      window.clearTimeout(wheelTimer);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, [reveal, set, headerRef]);

  // Sticky rails, the reading pill and anchor jumps read this to stay clear of
  // the header while it is over the content.
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--site-header-offset",
      mode === "pinned" ? SITE_HEADER_HEIGHT : "0px"
    );
  }, [mode]);

  return mode;
}
