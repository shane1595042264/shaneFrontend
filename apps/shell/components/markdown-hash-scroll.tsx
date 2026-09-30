"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Give up rather than yanking a reader who has started scrolling on their own. */
const DEADLINE_MS = 3000;

/** Retry cadence. Chrome clamps this to ~1s while the tab is hidden, which is the point. */
const POLL_MS = 32;

/** Further than this from the heading's scroll-margin line counts as "not landed". */
const LANDED_SLOP_PX = 2;

/**
 * What "the reader took over" actually means: an input gesture, not a scroll
 * event. See SHAN-546 below for why the difference matters.
 */
const TAKEOVER_EVENTS = ["wheel", "touchmove", "keydown", "mousedown"] as const;
const TAKEOVER_OPTIONS = { passive: true, capture: true } as const;

/**
 * decodeURIComponent throws on a malformed escape (a bare "#%" is enough), and
 * this now runs once per tick rather than once per mount, so a hand-edited URL
 * would otherwise throw from a timer on every retry.
 */
function targetId(): string {
  const raw = window.location.hash.slice(1);
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * SHAN-453: re-applies the URL fragment once the page is actually laid out.
 *
 * A cold load of /docs/auth#scopes or /docs/scoreboard-api#players left the
 * viewport at scrollY 0 even though the anchor existed. The article arrives in
 * a React Suspense chunk, so when the browser performs its one fragment scroll
 * the only element carrying that id is the copy inside React's hidden staging
 * container (`<div hidden id="S:0">`). scrollIntoView on a display:none node
 * silently no-ops, and once the real content is relocated the browser never
 * retries -- the deep link dies quietly.
 *
 * So we retry until the id resolves to a node that is actually rendered
 * (offsetParent is null while it is still inside the hidden container), then
 * jump. In-page TOC clicks were always fine; this only covers arriving with a
 * hash.
 *
 * SHAN-542: moved out of components/docs/ and renamed when blog posts got
 * anchored headings. Nothing about the problem is docs-specific -- the staging
 * container swallows a fragment on any streamed markdown page, and a post body
 * arriving late in a client fetch needs the same retry -- so both surfaces share
 * this one rather than keeping a second copy of the workaround.
 *
 * SHAN-546 rewrote the retry. The loop used to be driven by
 * requestAnimationFrame, which does not fire at all while a tab is hidden
 * (measured: 0 callbacks in 1s at visibilityState "hidden", 61 in 1s visible).
 * A document that loads in a background tab -- a middle-click, a restored
 * session, a link opened to read later -- therefore got no fallback whatsoever,
 * and if the browser's own fragment scroll had already no-opped against the
 * staging copy the reader arrived at scrollY 0 with the heading far below the
 * fold. A timer runs in a hidden tab (clamped to ~1s, so roughly three attempts
 * inside the deadline), and scrolling works there too, so this polls instead;
 * `visibilitychange` re-arms once on reveal for the case where the tab stayed
 * hidden past the deadline. That gap is also why this workaround could never be
 * verified through Chrome MCP, whose tab reports itself hidden: a repro there
 * is measuring the frozen loop, not the page.
 *
 * Two smaller defects went with it:
 *
 *  - The abort condition was `window.scrollY !== initialScrollY`, which cannot
 *    tell a reader apart from the browser. Any programmatic scroll -- the
 *    browser's own late fragment jump, Next's scroll handling -- killed the
 *    loop permanently. Take-over is read off real input events now, which is
 *    what the rule always meant.
 *  - One jump was not enough: whatever moves the offset can land after ours, so
 *    the loop keeps re-asserting the target until the deadline instead of
 *    returning on its first success. A settled page costs one cheap measurement
 *    per tick and no scrolling.
 *
 * The effect is keyed on the pathname, with a hashchange listener, so a client
 * navigation into the same [slug] segment re-arms it rather than reconciling
 * this component in place and never re-running. (The in-body cross-doc links
 * are plain markdown anchors and do a full document load, so that was not the
 * SHAN-546 symptom, but it is the same defect one navigation type over.)
 *
 * Known gap: a scrollbar drag inside the deadline dispatches no mouse event to
 * the page in Chrome, so it reads as programmatic and gets corrected. Bounded
 * to 3s on pages entered with a hash, and strictly better than a dead link.
 */
export function MarkdownHashScroll() {
  const pathname = usePathname();

  useEffect(() => {
    let timer = 0;
    let deadline = 0;
    let readerTookOver = false;
    // Whether the target has ever been where it belongs. Gates the reveal
    // retry so returning to a tab you were reading does not re-yank you.
    let landed = false;

    const onTakeOver = () => {
      readerTookOver = true;
    };

    const attempt = () => {
      timer = 0;
      if (readerTookOver) return;

      const id = targetId();
      if (!id) return;

      const el = document.getElementById(id);
      // offsetParent is null while the only copy of this node is still sitting
      // in React's hidden staging container.
      if (el && el.offsetParent !== null) {
        // scroll-mt-24 on the heading is where a correct landing puts it, so
        // that -- not 0 -- is the line to compare against.
        const margin = Number.parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
        if (Math.abs(el.getBoundingClientRect().top - margin) > LANDED_SLOP_PX) {
          const before = window.scrollY;
          // "auto", not "smooth": smooth scrolls get dropped elsewhere in this
          // app, and an instant jump is what a fragment load should look like.
          el.scrollIntoView({ behavior: "auto" });
          // Asked for a scroll and got nothing: the document is too short to
          // put this heading under the header, so it is already as close as it
          // can get. Stop rather than re-asking every tick.
          if (window.scrollY === before) {
            landed = true;
            return;
          }
        } else {
          landed = true;
        }
      }

      if (Date.now() < deadline) timer = window.setTimeout(attempt, POLL_MS);
    };

    const arm = () => {
      window.clearTimeout(timer);
      timer = 0;
      if (!window.location.hash) return;
      deadline = Date.now() + DEADLINE_MS;
      readerTookOver = false;
      attempt();
    };

    const onHashChange = () => {
      landed = false;
      arm();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (landed || readerTookOver) return;
      arm();
    };

    for (const type of TAKEOVER_EVENTS) {
      window.addEventListener(type, onTakeOver, TAKEOVER_OPTIONS);
    }
    window.addEventListener("hashchange", onHashChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    arm();

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("hashchange", onHashChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      for (const type of TAKEOVER_EVENTS) {
        window.removeEventListener(type, onTakeOver, TAKEOVER_OPTIONS);
      }
    };
  }, [pathname]);

  return null;
}
